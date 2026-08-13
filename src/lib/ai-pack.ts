import { aiJsonCompletion, isAiConfigured } from "./openai";
import type { CalculatedItem, LegInput, TravelerProfile } from "./types";

type AiSuggestResponse = {
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
    const ai = await aiJsonCompletion<AiSuggestResponse>({
      system: `Du bist Packlisten-Experte für FlexiPack (Paare/Gruppen, Multi-Etappen).
Schlage NUR zusätzliche sinnvolle Einträge vor, die in existing noch fehlen.
Keine Duplikate. Persönliche Dinge (Pass, ESTA, Powerbank, Ladekabel, Zahnbürste) nie als gemeinsam markieren.
Gemeinsam nur für wirklich Teilbares (Sonnencreme, Schirm, Erste Hilfe, Kabinen-Organizer).
JSON:
{
  "items": [{
    "name": string,
    "category": string,
    "quantity": number,
    "isShared": boolean,
    "notes": string,
    "forTraveler": string|null
  }],
  "tips": string[]
}
Max 12 Einträge, max 5 Tipps. Sprache: Schweizer Hochdeutsch (kein ß, ss verwenden).`,
      user: JSON.stringify({
        legs: args.legs,
        travelers: args.travelers,
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

    const items: CalculatedItem[] = (ai.items || [])
      .filter((i) => i?.name && !existingNames.has(i.name.toLowerCase()))
      .slice(0, 12)
      .map((i) => {
        const traveler = args.travelers.find(
          (t) =>
            t.name.toLowerCase() === String(i.forTraveler || "").toLowerCase()
        );
        const isShared = Boolean(i.isShared) && !traveler;
        return {
          name: String(i.name).slice(0, 80),
          category: String(i.category || "Sonstiges").slice(0, 40),
          quantity: Math.max(1, Number(i.quantity) || 1),
          isShared,
          notes: i.notes
            ? String(i.notes)
              : traveler
              ? `für ${traveler.name} · KI`
              : "KI-Vorschlag",
          source: "ai" as const,
          assigneeKey: isShared ? "shared" : traveler?.key || args.travelers[0]?.key,
        };
      });

    return {
      items,
      tips: (ai.tips || []).slice(0, 5).map(String),
      source: "openai",
    };
  } catch {
    return { items: [], tips: [], source: "none" };
  }
}
