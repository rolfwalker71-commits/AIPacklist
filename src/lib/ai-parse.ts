import { addDays, formatISO, isValid, parseISO, startOfDay } from "date-fns";
import { aiJsonCompletion, isAiConfigured } from "./openai";
import { parseVibePrompt } from "./vibe-parser";
import type {
  DressCode,
  LegInput,
  Transport,
  TripDraft,
  WeatherTag,
} from "./types";

function iso(d: Date) {
  return formatISO(startOfDay(d), { representation: "date" });
}

type AiLeg = {
  name: string;
  startDate: string;
  endDate: string;
  transport: Transport;
  laundryAvailable: boolean;
  laundryIntervalDays?: number | null;
  weatherTags: WeatherTag[];
  dressCodes: DressCode[];
};

type AiDraft = {
  title: string;
  startDate: string;
  endDate: string;
  legs: AiLeg[];
  rationale?: string;
};

const TRANSPORTS: Transport[] = ["SHIP", "FLIGHT", "CAR", "TRAIN", "OTHER"];
const WEATHER: WeatherTag[] = [
  "cool_windy",
  "tropical",
  "uncertain",
  "cold",
  "hot",
  "rainy",
];
const DRESS: DressCode[] = ["gala", "casual", "sport", "smart_casual"];

function sanitizeLeg(raw: AiLeg, fallbackStart: Date): LegInput | null {
  const start = parseISO(raw.startDate);
  const end = parseISO(raw.endDate);
  if (!isValid(start) || !isValid(end)) return null;
  return {
    name: String(raw.name || "Etappe").slice(0, 80),
    startDate: iso(start),
    endDate: iso(end < start ? start : end),
    transport: TRANSPORTS.includes(raw.transport) ? raw.transport : "OTHER",
    laundryAvailable: Boolean(raw.laundryAvailable),
    laundryIntervalDays: raw.laundryAvailable
      ? Number(raw.laundryIntervalDays || 3)
      : null,
    weatherTags: (raw.weatherTags || []).filter((t): t is WeatherTag =>
      WEATHER.includes(t)
    ),
    dressCodes: (raw.dressCodes || []).filter((t): t is DressCode =>
      DRESS.includes(t)
    ),
  };
}

export async function parseVibeWithAi(
  prompt: string,
  startDate?: string
): Promise<{ draft: TripDraft; source: "openai" | "rules"; rationale?: string }> {
  if (!isAiConfigured()) {
    return { draft: parseVibePrompt(prompt, startDate), source: "rules" };
  }

  const start = startDate ? parseISO(startDate) : new Date();
  const startIso = iso(isValid(start) ? start : new Date());

  try {
    const ai = await aiJsonCompletion<AiDraft>({
      system: `Du bist Reiseplaner für FlexiPack. Zerlege Freitext in strukturierte Multi-Etappen-Reisen.
Antworte NUR als JSON mit:
{
  "title": string,
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "legs": [{
    "name": string,
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "transport": "SHIP"|"FLIGHT"|"CAR"|"TRAIN"|"OTHER",
    "laundryAvailable": boolean,
    "laundryIntervalDays": number|null,
    "weatherTags": ("cool_windy"|"tropical"|"uncertain"|"cold"|"hot"|"rainy")[],
    "dressCodes": ("gala"|"casual"|"sport"|"smart_casual")[]
  }],
  "rationale": string
}
Regeln:
- Etappen lückenlos und chronologisch.
- Wenn Start datum vorgegeben ist, daran halten.
- Ohne Wäsche explizit laundryAvailable=false.
- Kreuzfahrt/Schiff => SHIP; erkenne Gala, Atlantik/Oktober => cool_windy/uncertain.
- Deutsch oder Englisch verstehen.`,
      user: `Start (optional): ${startIso}\nPrompt: ${prompt}`,
    });

    const legs = (ai.legs || [])
      .map((l) => sanitizeLeg(l, start))
      .filter((l): l is LegInput => Boolean(l));

    if (!legs.length) {
      return { draft: parseVibePrompt(prompt, startDate), source: "rules" };
    }

    const draft: TripDraft = {
      title: ai.title || legs[0].name,
      startDate: ai.startDate || legs[0].startDate,
      endDate: ai.endDate || legs[legs.length - 1].endDate,
      legs,
    };

    return { draft, source: "openai", rationale: ai.rationale };
  } catch {
    return { draft: parseVibePrompt(prompt, startDate), source: "rules" };
  }
}

/** Keep for tests / offline demos */
export function ensureContiguousFallback(prompt: string, startDate?: string) {
  const draft = parseVibePrompt(prompt, startDate);
  if (!draft.legs.length) {
    const s = startDate ? parseISO(startDate) : new Date();
    draft.legs = [
      {
        name: "Etappe 1",
        startDate: iso(s),
        endDate: iso(addDays(s, 6)),
        transport: "OTHER",
        laundryAvailable: false,
        weatherTags: ["uncertain"],
        dressCodes: ["casual"],
      },
    ];
  }
  return draft;
}
