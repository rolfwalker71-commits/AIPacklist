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
      body: String(g.body || "").slice(0, 5000),
    }))
    .filter((g) => g.body.length > 20)
    .slice(0, 10);
}

/** Shared research brief for destination-aware packing + tips. */
const DESTINATION_RESEARCH = `Reiseziel-Recherche (sehr wichtig — location und Etappen-Namen ernst nehmen):
- Einreise & Formalitäten für Personen mit CH/EU-Pass UND Hinweise falls abweichend: Visa/ESTA/ETA/eTA, Passgültigkeit (oft 6 Monate), Rück-/Weiterflugnachweis, Impfungen/Gesundheitszeugnisse, Zollfreimengen.
- Lokale Vorschriften: Bargeld/Karten, Trinkgeld, Steckertyp, Notfallnummern, Notruf, Versicherungen.
- Do's and Don'ts: Kleidung/Dresscodes, Fotografieren, Religion/Kultur, Alkohol/Drogen, Drohnen, öffentliche Verkehrsmittel, Sicherheit.
- Klima & Gegebenheiten: Wetter je Etappe, Waschen, typische Aktivitäten, was man vor Ort günstig kauft vs. mitbringen sollte.
- Kinder/weitere Personen: altersgerechte Items und Formalitäten mitdenken, wenn mehrere Reisende.
Frühe Priorität (EARLY) für alles, was vor Abreise beantragt/geprüft werden muss.`;

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
1) Für JEDE Person in travelers persönliche Items (isShared=false, forTraveler=exakter Name): Pass, Tickets, Einreiseformulare, Zahnbürste, Medikamente, Unterwäsche, Powerbank, Ladekabel, eigene Schuhe/Abendgarderobe. Auch Kind/3. Person vollständig bedenken.
2) Gemeinsam (isShared=true): nur wirklich Teilbares (Zahnpasta, Duschgel, Sonnencreme, Schirm, Erste Hilfe).
3) Priorität: EARLY (Formulare/Visa/Impfung/Einreise), DAY_OF (Bordkarte/Schlüssel), NORMAL sonst.
4) ${DESTINATION_RESEARCH}
5) Schweizer Hochdeutsch (ss statt ß).

Zusätzlich:
- tips: 10–18 kurze, konkrete Bullet-Tipps (mind. 4 zu Einreise/Vorschriften/Do's-Don'ts).
- guides: 5–8 längere Abschnitte (je 3–7 Sätze), davon mind. je einer zu: Einreisebestimmungen, lokale Vorschriften, Do's and Don'ts, Klima/Alltag vor Ort.

JSON:
{
  "items": [{ "name": string, "category": string, "quantity": number, "isShared": boolean, "notes": string, "forTraveler": string|null, "priority": "EARLY"|"NORMAL"|"DAY_OF" }],
  "tips": string[],
  "guides": [{ "title": string, "body": string }]
}
Ziel: 30–70 Items (steigt mit Anzahl Reisender).`,
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
    const tips = (ai.tips || []).slice(0, 18).map(String);
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
Nur fehlende Items. Für JEDE Person in travelers prüfen, ob persönliche Basics und zielbezogene Formalitäten fehlen — auch für später hinzugekommene Personen/Kinder.
Persönlich vs gemeinsam wie üblich. ${DESTINATION_RESEARCH}
tips: 10–15 kurze Tipps (Einreise, Vorschriften, Do's/Don'ts).
guides: 5–8 längere Abschnitte inkl. Einreisebestimmungen und lokale Gegebenheiten.
Schweizer Hochdeutsch. JSON: {"items":[...],"tips":[...],"guides":[{"title","body"}]}. Max 20 Items.`,
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
      items: items.slice(0, 20),
      tips: (ai.tips || []).slice(0, 18).map(String),
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
${DESTINATION_RESEARCH}
Schweizer Hochdeutsch (ss statt ß).
JSON: {
  "tips": string[] (12–20 kurze Tipps, mind. je 2 zu Einreise, Vorschriften, Do's/Don'ts),
  "guides": [{ "title": string, "body": string }] (6–10 längere Abschnitte, je 3–8 Sätze; Titel z.B. «Einreise & Formalitäten», «Lokale Vorschriften», «Do's and Don'ts», «Klima & Alltag», «Gesundheit & Sicherheit»)
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
      tips: (ai.tips || []).slice(0, 20).map(String),
      guides: mapGuides(ai.guides),
      source: "openai",
    };
  } catch {
    return { tips: [], guides: [], source: "none" };
  }
}
