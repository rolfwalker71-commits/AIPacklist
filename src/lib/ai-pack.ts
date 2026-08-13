import { aiJsonCompletion, isAiConfigured } from "./openai";
import { calculatePackList, summarizeLaundry } from "./calculator";
import type { CalculatedItem, LegInput, TravelerProfile } from "./types";

type AiPackResponse = {
  items: {
    name: string;
    category: string;
    quantity: number;
    isShared: boolean;
    notes?: string;
    forTraveler?: string | null;
  }[];
  tips?: string[];
};

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

    // Personal item without traveler → expand to every traveler
    if (!isShared && !traveler && travelers.length > 0) {
      for (const t of travelers) {
        items.push({
          name: String(i.name).slice(0, 80),
          category: String(i.category || "Sonstiges").slice(0, 40),
          quantity: Math.max(1, Number(i.quantity) || 1),
          isShared: false,
          notes: i.notes
            ? `für ${t.name} · ${i.notes}`
            : `für ${t.name} · KI`,
          source: "ai",
          assigneeKey: t.key,
        });
      }
      continue;
    }

    if (isShared && traveler) isShared = false;

    items.push({
      name: String(i.name).slice(0, 80),
      category: String(i.category || "Sonstiges").slice(0, 40),
      quantity: Math.max(1, Number(i.quantity) || 1),
      isShared,
      notes: i.notes
        ? String(i.notes)
        : isShared
          ? "gemeinsam · KI"
          : traveler
            ? `für ${traveler.name} · KI`
            : "KI",
      source: "ai",
      assigneeKey: isShared
        ? "shared"
        : traveler?.key || travelers[0]?.key || "traveler-1",
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
      source: "rules",
      laundry,
    };
  }

  try {
    const ai = await aiJsonCompletion<AiPackResponse>({
      system: `Du bist Packlisten-Experte für FlexiPack (Schweiz). Erstelle eine vollständige, praxisnahe Packliste.

Prinzipien (wichtiger als starre Listen):
1) Persönlich (isShared=false, forTraveler=Name): alles was nur eine Person braucht oder mitführen muss.
   Beispiele: Reisepass, Ausweis, Tickets/Bordkarten, ESTA/Visa, Zahnbürste, Medikamente, BH/Unterwäsche, Powerbank, Handy-Ladekabel, eigene Schuhe, eigene Abendgarderobe.
2) Gemeinsam (isShared=true, forTraveler=null): nur wirklich Teilbares.
   Beispiele: Zahnpasta, Duschgel, Sonnencreme, Schirm, Erste Hilfe, Kabinen-Organizer, Auto-Ladekabel.
3) NIEMALS Reisepass/Tickets/ESTA/Zahnbürste als gemeinsam markieren.
4) Mengen an Waschtagen und Etappen anpassen (siehe laundryStats).
5) Pro Person eigene Kleidungsmengen; bei Paaren nicht alles doppelt als "gemeinsam" ablegen.
6) Sprache: Schweizer Hochdeutsch (ss statt ß).

JSON:
{
  "items": [{
    "name": string,
    "category": "Kleidung"|"Pflege"|"Dokumente"|"Technik"|"Schuhe"|"Festlich"|"Aktivität"|"Gesundheit"|"Accessoires"|"Freizeit"|"Reise"|"Sonstiges",
    "quantity": number,
    "isShared": boolean,
    "notes": string,
    "forTraveler": string|null
  }],
  "tips": string[]
}
Ziel: 25–55 sinnvolle Einträge, max 6 Tipps.`,
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
    if (items.length < 8) {
      return {
        items: calculatePackList(args.legs, travelers),
        tips: ai.tips || [],
        source: "rules",
        laundry,
      };
    }

    return {
      items,
      tips: (ai.tips || []).slice(0, 6).map(String),
      source: "openai",
      laundry,
    };
  } catch {
    return {
      items: calculatePackList(args.legs, travelers),
      tips: [],
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
  source: "openai" | "none";
}> {
  if (!isAiConfigured()) {
    return { items: [], tips: [], source: "none" };
  }

  try {
    const ai = await aiJsonCompletion<AiPackResponse>({
      system: `Du ergänzt eine bestehende FlexiPack-Packliste. Nur fehlende, sinnvolle Einträge.
Persönlich: Pass, Tickets, ESTA, Zahnbürste, Powerbank, Ladekabel, Medikamente — nie gemeinsam.
Gemeinsam: nur Zahnpasta, Sonnencreme, Schirm, Erste Hilfe, Organizer, Duschgel.
Schweizer Hochdeutsch. JSON wie {"items":[...], "tips":[...]}. Max 12 Items, max 5 Tipps.`,
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
      tips: (ai.tips || []).slice(0, 5).map(String),
      source: "openai",
    };
  } catch {
    return { items: [], tips: [], source: "none" };
  }
}
