import { aiJsonCompletion, isAiConfigured } from "./openai";
import { calculatePackList, summarizeLaundry } from "./calculator";
import {
  inferPriority,
  mergePriority,
  parseAiPriority,
  type PackPriority,
} from "./priority";
import { filterNewPackItems } from "./pack-dedupe";
import {
  expandPersonalItems,
  isAlwaysPersonalItem,
  matchTravelerFromAi,
} from "./pack-ownership";
import type { CalculatedItem, LegInput, TravelerProfile } from "./types";

type AiPackResponse = {
  items: {
    name: string;
    category: string;
    quantity: number;
    isShared: boolean;
    notes?: string;
    forTraveler?: string | null;
    forTravelerId?: string | null;
    priority?: string;
    suggestedBag?: string | null;
  }[];
  tips?: string[];
  guides?: { title?: string; body?: string }[];
  capacityNote?: string | null;
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

function forcePersonalIfNeeded(
  name: string,
  category: string,
  isShared: boolean
): boolean {
  if (isAlwaysPersonalItem(name, category)) return false;
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
    const name = String(i.name).slice(0, 80);
    const category = String(i.category || "Sonstiges").slice(0, 40);
    const quantity = Math.max(1, Number(i.quantity) || 1);
    const traveler = matchTravelerFromAi(
      { forTravelerId: i.forTravelerId, forTraveler: i.forTraveler },
      travelers
    );
    let isShared = forcePersonalIfNeeded(
      name,
      category,
      Boolean(i.isShared)
    );
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
        : traveler?.key || undefined,
      priority: itemPriority(name, category, notes, i.priority),
      suggestedBag: i.suggestedBag ? String(i.suggestedBag) : null,
    });
  }

  return expandPersonalItems(items, travelers);
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
1) Für JEDE Person in travelers EIGENE Zeilen (isShared=false, forTravelerId=exakte id aus travelers). NIEMALS eine Zeile mit Menge = Personenanzahl auf eine Person legen. Beispiel falsch: Zahnbürste qty 2 für eine Person. Richtig: je eine Zeile qty 1 mit der jeweiligen forTravelerId. Gleich für Pass, Tickets, Unterwäsche, T-Shirts, Socken, Ladekabel, Powerbank, Schuhe.
2) Mengen sind immer pro Person (T-Shirts qty 3 = 3 Stück für DIESE Person, nicht für die Gruppe).
3) Gemeinsam (isShared=true, forTravelerId=null, forTraveler=null): nur wirklich Teilbares (Zahnpasta, Duschgel, Sonnencreme, Schirm, Erste Hilfe).
4) forTravelerId MUSS eine id aus travelers sein oder null. Keine erfundenen IDs, keine Zuweisung an eine Default-Person.
5) Priorität: EARLY (Formulare/Visa/Impfung/Einreise), DAY_OF (Bordkarte/Schlüssel), NORMAL sonst.
6) ${DESTINATION_RESEARCH}
7) Schweizer Hochdeutsch (ss statt ß).

Zusätzlich:
- tips: 10–18 kurze, konkrete Bullet-Tipps (mind. 4 zu Einreise/Vorschriften/Do's-Don'ts).
- guides: 5–8 längere Abschnitte (je 3–7 Sätze), davon mind. je einer zu: Einreisebestimmungen, lokale Vorschriften, Do's and Don'ts, Klima/Alltag vor Ort.

JSON:
{
  "items": [{ "name": string, "category": string, "quantity": number, "isShared": boolean, "notes": string, "forTravelerId": string|null, "forTraveler": string|null, "priority": "EARLY"|"NORMAL"|"DAY_OF" }],
  "tips": string[],
  "guides": [{ "title": string, "body": string }]
}
Ziel: 30–70 Items (steigt mit Anzahl Reisender).`,
      user: JSON.stringify({
        legs: args.legs,
        travelers: travelers.map((t) => ({
          id: t.key,
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
  suitcases?: {
    id: string;
    name: string;
    size: string;
    isShared: boolean;
    ownerUserId: string | null;
    ownerName?: string | null;
    softMaxItems: number;
    currentItems: number;
  }[];
}): Promise<{
  items: CalculatedItem[];
  tips: string[];
  guides: { title: string; body: string }[];
  source: "openai" | "none";
  capacityNote: string | null;
}> {
  if (!isAiConfigured()) {
    return {
      items: [],
      tips: [],
      guides: [],
      source: "none",
      capacityNote: null,
    };
  }

  try {
    const bags = args.suitcases || [];
    const ai = await aiJsonCompletion<AiPackResponse>({
      system: `Du bist Packlisten-Experte für FlexiPack (Schweiz). Erstelle die ideale, vollständige Packliste für diese Reise — und liefere Reiseinfos.

Wichtig — Abgleich mit «existing» (bereits auf der Liste):
- Denke die Idealliste komplett (wie bei einer neuen Reise).
- Gib in «items» NUR Positionen zurück, die in existing für dieselbe Person (forTravelerId) bzw. als Gemeinsam NOCH FEHLEN.
- Semantische Duplikate NIEMALS erneut vorschlagen: Pass≈Reisepass≈Ausweis, T-Shirt≈Shirt≈Oberteil, Socken≈Sockenpaar, Ladekabel≈USB-Kabel, Sonnencreme≈Sonnenschutz, Regenjacke≈Regenmantel, Zahnbürste≈Zahnputzzeug, Medikamente≈Reiseapotheke, Unterwäsche≈Slips/Boxershorts.
- Auch ähnliche Schreibweisen, Singular/Plural und «für Name» in notes zählen als schon vorhanden.
- Mengen bestehender Items nicht erhöhen — nur ganz neue Lücken schliessen.
- Für JEDE Person in travelers prüfen: persönliche Basics und zielbezogene Formalitäten — je eigene Zeile mit forTravelerId, keine Gruppenmenge auf einer Person.
- forTravelerId MUSS eine id aus travelers sein oder null. Keine Default-Person.
- Persönlich vs gemeinsam wie üblich. ${DESTINATION_RESEARCH}

Koffer-Kapazität:
- suitcases: Name, Grösse, Soft-Max, aktuelle Belegung.
- suggestedBag = exakter Koffer-Name; persönlich → Personenkoffer, gemeinsam → gemeinsamer Koffer.
- capacityNote auf Deutsch wenn Limits knapp, sonst null.

tips: 10–15 kurze Tipps. guides: 5–8 längere Abschnitte.
Schweizer Hochdeutsch (ss).
JSON: {"items":[{"name","category","quantity","isShared","notes","forTravelerId","forTraveler","priority","suggestedBag"}],"tips":[...],"guides":[{"title","body"}],"capacityNote":string|null}.
Max 35 Items (nur echte Lücken).`,
      user: JSON.stringify({
        legs: args.legs,
        travelers: args.travelers.map((t) => ({
          id: t.key,
          name: t.name,
          gender: t.gender,
        })),
        suitcases: bags,
        existing: args.existing.map((i) => ({
          name: i.name,
          category: i.category,
          isShared: i.isShared,
          notes: i.notes,
          forTravelerId: i.isShared
            ? null
            : i.assigneeKey && i.assigneeKey !== "shared"
              ? i.assigneeKey
              : null,
          forTraveler: i.isShared
            ? null
            : args.travelers.find((t) => t.key === i.assigneeKey)?.name ||
              (i.notes || "").match(/für\s+([^·]+)/i)?.[1]?.trim() ||
              null,
          priority: i.priority,
        })),
      }),
      temperature: 0.3,
    });

    const bagByName = new Map(
      bags.map((b) => [b.name.toLowerCase(), b.id] as const)
    );
    const mapped = mapAiItems(ai.items || [], args.travelers).map((i) => {
      const hint = i.suggestedBag?.trim();
      const preferredSuitcaseId = hint
        ? bagByName.get(hint.toLowerCase()) || null
        : null;
      return { ...i, preferredSuitcaseId: preferredSuitcaseId || undefined };
    });

    // Server-side semantic dedupe (AI alone is not reliable enough)
    const items = filterNewPackItems(mapped, args.existing).slice(0, 35);

    return {
      items,
      tips: (ai.tips || []).slice(0, 18).map(String),
      guides: mapGuides(ai.guides),
      source: "openai",
      capacityNote: ai.capacityNote
        ? String(ai.capacityNote).slice(0, 400)
        : null,
    };
  } catch {
    return {
      items: [],
      tips: [],
      guides: [],
      source: "none",
      capacityNote: null,
    };
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
