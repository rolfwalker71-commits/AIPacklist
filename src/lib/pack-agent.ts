import { nanoid } from "nanoid";
import { aiJsonCompletion, isAiConfigured } from "./openai";
import { calculatePackList } from "./calculator";
import { suggestCategory } from "./categorize";
import { filterNewPackItems } from "./pack-dedupe";
import {
  isAlwaysPersonalItem,
  travelerFitsItemGender,
} from "./pack-ownership";
import { inferPriority, parseAiPriority, type PackPriority } from "./priority";
import type { LegInput, TravelerProfile } from "./types";

export type AgentScope = "person" | "both" | "shared";

export type AgentProposal = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  reason: string;
  priority: PackPriority;
  suggestedScope: AgentScope;
  suggestedUserId: string | null;
};

export type AgentChatTurn = {
  role: "user" | "assistant";
  text: string;
};

export type AgentReview = {
  reply: string;
  complete: boolean;
  source: "openai" | "rules";
  proposals: AgentProposal[];
};

type ExistingRow = {
  name: string;
  category: string;
  isShared: boolean;
  notes?: string | null;
  ownerUserId?: string | null;
  assigneeKey?: string | null;
};

type AiAgentJson = {
  reply?: string;
  complete?: boolean;
  proposals?: {
    name?: string;
    category?: string;
    quantity?: number;
    reason?: string;
    priority?: string;
    scope?: string;
    forTravelerId?: string | null;
  }[];
};

function newId() {
  return `gap-${nanoid(8)}`;
}

function asScope(raw: unknown, fallback: AgentScope): AgentScope {
  if (raw === "person" || raw === "both" || raw === "shared") return raw;
  if (raw === "gemeinsam") return "shared";
  if (raw === "beide") return "both";
  return fallback;
}

function defaultScope(
  name: string,
  category: string,
  travelers: TravelerProfile[]
): AgentScope {
  if (isAlwaysPersonalItem(name, category)) {
    return travelers.length > 1 ? "both" : "person";
  }
  return "shared";
}

function mapProposal(
  raw: NonNullable<AiAgentJson["proposals"]>[number],
  travelers: TravelerProfile[]
): AgentProposal | null {
  const name = String(raw.name || "").trim().slice(0, 80);
  if (!name) return null;
  const category = (raw.category || suggestCategory(name)).trim().slice(0, 40);
  const suggestedScope = asScope(
    raw.scope,
    defaultScope(name, category, travelers)
  );
  const rawId =
    typeof raw.forTravelerId === "string" ? raw.forTravelerId : null;
  const suggestedUserId =
    suggestedScope === "person" && travelers.some((t) => t.key === rawId)
      ? rawId
      : suggestedScope === "person"
        ? travelers[0]?.key || null
        : null;

  return {
    id: newId(),
    name,
    category,
    quantity: Math.max(1, Math.min(12, Number(raw.quantity) || 1)),
    reason: String(raw.reason || "Könnte auf dieser Reise fehlen.")
      .trim()
      .slice(0, 220),
    priority: parseAiPriority(raw.priority) || inferPriority(name, category),
    suggestedScope,
    suggestedUserId,
  };
}

function existingAsDedupe(existing: ExistingRow[]) {
  return existing.map((i) => ({
    name: i.name,
    isShared: i.isShared,
    notes: i.notes,
    ownerUserId: i.ownerUserId || null,
    assigneeKey: i.isShared
      ? "shared"
      : i.assigneeKey && i.assigneeKey !== "shared"
        ? i.assigneeKey
        : i.ownerUserId || undefined,
  }));
}

function rulesFallback(
  legs: LegInput[],
  travelers: TravelerProfile[],
  existing: ExistingRow[]
): AgentReview {
  const calculated = calculatePackList(legs, travelers);
  const fresh = filterNewPackItems(
    calculated.map((item) => ({
      ...item,
      ownerUserId:
        item.isShared || item.assigneeKey === "shared"
          ? null
          : item.assigneeKey || null,
    })),
    existingAsDedupe(existing)
  );

  const proposals: AgentProposal[] = fresh.slice(0, 12).map((item) => {
    const personal =
      !item.isShared && item.assigneeKey && item.assigneeKey !== "shared";
    return {
      id: newId(),
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      reason: "Fehlt laut Rechner für Route, Wetter oder Personen.",
      priority: item.priority || inferPriority(item.name, item.category),
      suggestedScope: item.isShared
        ? "shared"
        : travelers.length > 1 && isAlwaysPersonalItem(item.name, item.category)
          ? "both"
          : personal
            ? "person"
            : "shared",
      suggestedUserId: personal ? item.assigneeKey || null : null,
    };
  });

  const complete = proposals.length === 0;
  return {
    reply: complete
      ? "Die Packliste wirkt vollständig für diese Route. Frag nach, wenn du etwas Spezielles ergänzen willst — z.B. Sport, Medikamente oder ein festliches Dinner."
      : `Ich habe ${proposals.length} mögliche Lücke${proposals.length === 1 ? "" : "n"} gefunden. Soll ich sie für eine Person, für beide oder gemeinsam aufnehmen?`,
    complete,
    source: "rules",
    proposals,
  };
}

const SYSTEM = `Du bist der Pack-Agent von FlexiPack (Schweiz). Du prüfst, ob eine Packliste für die Reise vollständig wirkt, fragst nach, und schlägst NUR fehlende Dinge vor.

Regeln:
- Schweizer Hochdeutsch (ss statt ß). Freundlich, knapp, konkret.
- reply: 2–5 Sätze. Sage klar, ob die Liste vollständig wirkt oder was fehlt. Stelle 1–2 Rückfragen (Sport? Medikamente? feste Anlässe?).
- proposals: nur echte Lücken, die in «existing» für dieselbe Person bzw. als Gemeinsam noch fehlen. Max 10.
- Semantische Duplikate nie vorschlagen (Pass≈Reisepass, T-Shirt≈Shirt, Ladekabel≈USB-Kabel, Sonnencreme≈Sonnenschutz).
- Persönliche Dinge (Pass, Zahnbürste, Unterwäsche, Ladekabel, Schuhe): scope «both» wenn mehrere Reisende, sonst «person» + forTravelerId.
- Wirklich Teilbares (Zahnpasta, Duschgel, Sonnencreme, Schirm, Erste Hilfe): scope «shared».
- Geschlecht beachten: kein Abendkleid für MALE, kein Smoking für FEMALE. Bei «both» nur geschlechtsneutrale Dinge.
- forTravelerId nur eine id aus travelers.
- Keine Mengen aufblähen, keine ganzen Listen wiederholen.
- complete=true nur wenn wirklich nichts Wichtiges fehlt.

JSON:
{
  "reply": string,
  "complete": boolean,
  "proposals": [{
    "name": string,
    "category": string,
    "quantity": number,
    "reason": string,
    "priority": "EARLY"|"NORMAL"|"DAY_OF",
    "scope": "person"|"both"|"shared",
    "forTravelerId": string|null
  }]
}`;

export async function reviewPackWithAgent(args: {
  title?: string;
  legs: LegInput[];
  travelers: TravelerProfile[];
  existing: ExistingRow[];
  message?: string;
  history?: AgentChatTurn[];
}): Promise<AgentReview> {
  const travelers =
    args.travelers.length > 0
      ? args.travelers
      : [
          {
            key: "traveler-1",
            name: "Reisende:r",
            gender: "UNSPECIFIED" as const,
          },
        ];

  if (!isAiConfigured()) {
    const fallback = rulesFallback(args.legs, travelers, args.existing);
    if (args.message?.trim()) {
      return {
        ...fallback,
        reply: `${fallback.reply} (Ohne OpenAI-Schlüssel arbeite ich mit der Rechner-Liste.)`,
      };
    }
    return fallback;
  }

  try {
    const ai = await aiJsonCompletion<AiAgentJson>({
      system: SYSTEM,
      user: JSON.stringify({
        title: args.title,
        legs: args.legs,
        travelers: travelers.map((t) => ({
          id: t.key,
          name: t.name,
          gender: t.gender,
        })),
        existing: args.existing.map((i) => ({
          name: i.name,
          category: i.category,
          isShared: i.isShared,
          notes: i.notes,
          forTravelerId: i.isShared
            ? null
            : i.ownerUserId ||
              (i.assigneeKey && i.assigneeKey !== "shared"
                ? i.assigneeKey
                : null),
        })),
        history: (args.history || []).slice(-8),
        userMessage:
          args.message?.trim() ||
          "Prüfe die Packliste auf Vollständigkeit. Was könnte fehlen?",
      }),
      temperature: 0.3,
    });

    const mapped = (ai.proposals || [])
      .map((p) => mapProposal(p, travelers))
      .filter((p): p is AgentProposal => Boolean(p));

    const proposals = filterNewPackItems(
      mapped.map((p) => ({
        ...p,
        isShared: p.suggestedScope === "shared",
        ownerUserId:
          p.suggestedScope === "person" ? p.suggestedUserId : null,
        assigneeKey:
          p.suggestedScope === "shared"
            ? "shared"
            : p.suggestedUserId || undefined,
      })),
      existingAsDedupe(args.existing)
    ).slice(0, 10);

    const reply = String(
      ai.reply ||
        (proposals.length
          ? "Ein paar Dinge könnten noch fehlen — soll ich sie aufnehmen?"
          : "Die Liste wirkt vollständig.")
    ).slice(0, 900);

    return {
      reply,
      complete: Boolean(ai.complete) && proposals.length === 0,
      source: "openai",
      proposals: proposals.map(({ isShared: _s, ownerUserId: _o, assigneeKey: _a, ...p }) => p),
    };
  } catch {
    return rulesFallback(args.legs, travelers, args.existing);
  }
}

export type ApplyLine = {
  name: string;
  category?: string;
  quantity?: number;
  priority?: PackPriority;
  notes?: string | null;
  scope: AgentScope;
  ownerUserId?: string | null;
};

export function expandApplyLines(
  line: ApplyLine,
  travelers: TravelerProfile[]
): { name: string; category: string; quantity: number; priority: PackPriority; notes: string | null; isShared: boolean; ownerUserId: string | null }[] {
  const name = line.name.trim().slice(0, 80);
  const category = (line.category || suggestCategory(name)).slice(0, 40);
  const quantity = Math.max(1, Math.min(12, Number(line.quantity) || 1));
  const priority = line.priority || inferPriority(name, category, line.notes);
  const extra = line.notes?.trim() || null;

  let scope = line.scope;
  if (isAlwaysPersonalItem(name, category) && scope === "shared") {
    scope = travelers.length > 1 ? "both" : "person";
  }

  if (scope === "shared") {
    return [
      {
        name,
        category,
        quantity,
        priority,
        notes: extra,
        isShared: true,
        ownerUserId: null,
      },
    ];
  }

  const targets =
    scope === "both"
      ? travelers.filter((t) => travelerFitsItemGender(t.gender, name))
      : travelers.filter((t) => t.key === line.ownerUserId);

  const people = targets.length
    ? targets
    : travelers[0]
      ? [travelers[0]]
      : [];

  return people.map((t) => ({
    name,
    category,
    quantity,
    priority,
    notes: extra,
    isShared: false,
    ownerUserId: t.key,
  }));
}
