import { aiJsonCompletion, isAiConfigured } from "./openai";
import { calculatePackList, summarizeLaundry } from "./calculator";
import {
  inferPriority,
  mergePriority,
  parseAiPriority,
  type PackPriority,
} from "./priority";
import type { CalculatedItem, LegInput, TravelerProfile } from "./types";

type AiPackResponse = {
  items: {
    name: string;
    category: string;
    quantity: number;
    isShared: boolean;
    notes?: string;
    forTraveler?: string | null;
    priority?: string;
  }[];
  tips?: string[];
  guides?: { title?: string; body?: string }[];
};

function mapGuides(
  raw: AiPackResponse["guides"]
): { title: string; body: string }[] {
  return (raw || [])
    .filter((g) => g && (g.title || g.body))
    .map((g) => ({
      title: String(g.title || "Reisetipp").slice(0, 120),
      body: String(g.body || "").slice(0, 4000),
    }))
    .filter((g) => g.body.length > 20)
    .slice(0, 8);
}

/** Hard safety net — never let these become "gemeinsam". */
const ALWAYS_PERSONAL = [
  "reisepass",
  "ausweis",
  "pass",
  "esta",
  "eta",
  "visa",
  "ticket",
  "bordkarte",
  "zahnbürste",
  "zahnbuerste",
  "powerbank",
  "ladekabel",
  "netzteil",
  "handy-lad",
  "medikament",
  "bh",
  "boxershort",
];

function forcePersonalIfNeeded(name: string, isShared: boolean): boolean {
  const n = name.toLowerCase();
  if (ALWAYS_PERSONAL.some((k) => n.includes(k))) return false;
  return isShared;
}

function itemPriority(
  name: string,
  category: string,
  notes: string | undefined,
  aiPriority: unknown
): PackPriority {
  const fromAi = parseAiPriority(aiPriority);
  const inferred = inferPriority(name, category, notes);
  return fromAi ? mergePriority(fromAi, inferred) : inferred;
}

function mapAiItems(
  raw: AiPackResponse["items"],
  travelers: TravelerProfile[]
): CalculatedItem[] {
  const items: CalculatedItem[] = [];

  for (const i of raw || []) {
    if (!i?.name) continue;
    const traveler = travelers.find(
      (t) => t.name.toLowerCase() === String(i.forTraveler || "").toLowerCase()
    );
    let isShared = forcePersonalIfNeeded(i.name, Boolean(i.isShared));
    const name = String(i.name).slice(0, 80);
    const category = String(i.category || "Sonstiges").slice(0, 40);
    const quantity = Math.max(1, Number(i.quantity) || 1);

    // Personal item without traveler → expand to every traveler
    if (!isShared && !traveler && travelers.length > 0) {
      for (const t of travelers) {
        const notes = i.notes
          ? `für ${t.name} · ${i.notes}`
          : `für ${t.name} · KI`;
        items.push({
          name,
          category,
          quantity,
          isShared: false,
          notes,
          source: "ai",
          assigneeKey: t.key,
          priority: itemPriority(name, category, notes, i.priority),
        });
      }
      continue;
    }

    if (isShared && traveler) isShared = false;

    const notes = i.notes
      ? String(i.notes)
      : isShared
        ? "gemeinsam · KI"
        : traveler
          ? `für ${traveler.name} · KI`
          : "KI";

    items.push({
      name,
      category,
      quantity,
      isShared,
      notes,
      source: "ai",
      assigneeKey: isShared
        ? "shared"
        : traveler?.key || travelers[0]?.key || "traveler-1",
      priority: itemPriority(name, category, notes, i.priority),
    });
  }

  return items;
}

/**
 * AI-first pack list. Uses laundry math as context only.
 * Falls back to rule calculator when OpenAI is unavailable.
 */
export async function buildPackList(args: {
  legs: LegInput[];
  travelers: TravelerProfile[];
}): Promise<{
  items: CalculatedItem[];
  tips: string[];
  guides: { title: string; body: string }[];
  source: "openai" | "rules";
  laundry: ReturnType<typeof summarizeLaundry>;
}> {
  const laundry = summarizeLaundry(args.legs);
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
    return {
      items: calculatePackList(args.legs, travelers),
      tips: [],
      guides: [],
      source: "rules",
      laundry,
    };
  }

  try {
    const ai = await aiJsonCompletion<AiPackResponse>({
      system: `Du bist Packlisten- und Reise-Experte für FlexiPack (Schweiz). Erstelle eine vollständige Packliste PLUS ausführliche Reisetipps.

Prinzipien Packliste:
1) Persönlich (isShared=false, forTraveler=Name): Pass, Tickets, ESTA/Visa, Zahnbürste, Medikamente, Unterwäsche, Powerbank, Ladekabel, eigene Schuhe/Abendgarderobe.
2) Gemeinsam (isShared=true): nur wirklich Teilbares (Zahnpasta, Duschgel, Sonnencreme, Schirm, Erste Hilfe).
3) Priorität: EARLY (Formulare/Visa/Impfung), DAY_OF (Bordkarte/Schlüssel), NORMAL sonst.
4) location der Etappen (Florida, Karibik, Transatlantik, Europa …) stark berücksichtigen: Klima, Formalitäten, typische Aktivitäten.
5) Schweizer Hochdeutsch (ss statt ß).

Zusätzlich:
- tips: 8–15 kurze, konkrete Bullet-Tipps
- guides: 3–6 längere Abschnitte (je 2–5 Sätze) zu Etappen/Regionen, z.B. ESTA/USA, Karibik-Inselhopping, Waschen an Bord, Gala, Wetter Transatlantik.

JSON:
{
  "items": [{ "name": string, "category": string, "quantity": number, "isShared": boolean, "notes": string, "forTraveler": string|null, "priority": "EARLY"|"NORMAL"|"DAY_OF" }],
  "tips": string[],
  "guides": [{ "title": string, "body": string }]
}
Ziel: 25–55 Items.`,
      user: JSON.stringify({
        legs: args.legs,
        travelers: travelers.map((t) => ({
          name: t.name,
          gender: t.gender,
        })),
        laundryStats: laundry,
      }),
      temperature: 0.35,
    });

    const items = mapAiItems(ai.items || [], travelers);
    const tips = (ai.tips || []).slice(0, 15).map(String);
    const guides = mapGuides(ai.guides);
    if (items.length < 8) {
      return {
        items: calculatePackList(args.legs, travelers),
        tips,
        guides,
        source: "rules",
        laundry,
      };
    }

    return {
      items,
      tips,
      guides,
      source: "openai",
      laundry,
    };
  } catch {
    return {
      items: calculatePackList(args.legs, travelers),
      tips: [],
      guides: [],
      source: "rules",
      laundry,
    };
  }
}

export async function enrichPackListWithAi(args: {
  legs: LegInput[];
  travelers: TravelerProfile[];
  existing: CalculatedItem[];
}): Promise<{
  items: CalculatedItem[];
  tips: string[];
  guides: { title: string; body: string }[];
  source: "openai" | "none";
}> {
  if (!isAiConfigured()) {
    return { items: [], tips: [], guides: [], source: "none" };
  }

  try {
    const ai = await aiJsonCompletion<AiPackResponse>({
      system: `Du ergänzt eine FlexiPack-Packliste und lieferst ausführliche Reiseinfos.
Nur fehlende Items. Persönlich vs gemeinsam wie üblich. location der Etappen nutzen.
tips: 8–12 kurze Tipps. guides: 3–6 längere Regional-/Etappen-Tipps (2–5 Sätze).
Schweizer Hochdeutsch. JSON: {"items":[...],"tips":[...],"guides":[{"title","body"}]}. Max 12 Items.`,
      user: JSON.stringify({
        legs: args.legs,
        travelers: args.travelers.map((t) => ({
          name: t.name,
          gender: t.gender,
        })),
        existing: args.existing.map((i) => ({
          name: i.name,
          category: i.category,
          isShared: i.isShared,
          notes: i.notes,
          priority: i.priority,
        })),
      }),
      temperature: 0.4,
    });

    const existingNames = new Set(
      args.existing.map((i) => i.name.toLowerCase())
    );
    const items = mapAiItems(ai.items || [], args.travelers).filter(
      (i) => !existingNames.has(i.name.toLowerCase())
    );

    return {
      items: items.slice(0, 12),
      tips: (ai.tips || []).slice(0, 15).map(String),
      guides: mapGuides(ai.guides),
      source: "openai",
    };
  } catch {
    return { items: [], tips: [], guides: [], source: "none" };
  }
}

/** Only travel tips/guides — no pack items. */
export async function buildTravelInsights(args: {
  legs: LegInput[];
  travelers: TravelerProfile[];
  title?: string;
}): Promise<{
  tips: string[];
  guides: { title: string; body: string }[];
  source: "openai" | "none";
}> {
  if (!isAiConfigured()) {
    return { tips: [], guides: [], source: "none" };
  }

  try {
    const ai = await aiJsonCompletion<{
      tips?: string[];
      guides?: { title?: string; body?: string }[];
    }>({
      system: `Du bist Reiseberater für FlexiPack (Schweiz). Schreibe ausführliche, praxisnahe Tipps zu den gegebenen Etappen und Orten (location).
Berücksichtige Klima, Formalitäten (ESTA/Visa), Gesundheit, Pack-Strategien, lokale Besonderheiten, Waschen, Transport.
Schweizer Hochdeutsch (ss statt ß).
JSON: {
  "tips": string[] (10–18 kurze Tipps),
  "guides": [{ "title": string, "body": string }] (4–8 längere Abschnitte, je 3–6 Sätze)
}`,
      user: JSON.stringify({
        title: args.title,
        legs: args.legs,
        travelers: args.travelers.map((t) => ({
          name: t.name,
          gender: t.gender,
        })),
      }),
      temperature: 0.45,
    });

    return {
      tips: (ai.tips || []).slice(0, 18).map(String),
      guides: mapGuides(ai.guides),
      source: "openai",
    };
  } catch {
    return { tips: [], guides: [], source: "none" };
  }
}
