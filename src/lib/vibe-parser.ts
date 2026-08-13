import { addDays, formatISO, startOfDay } from "date-fns";
import type { DressCode, LegInput, Transport, TripDraft, WeatherTag } from "./types";

function iso(d: Date) {
  return formatISO(startOfDay(d), { representation: "date" });
}

/**
 * Rule-based "Vibe Input" parser for German/English travel descriptions.
 * Optionally enhanced later via OPENAI_API_KEY — works fully offline by default.
 */
export function parseVibePrompt(prompt: string, startDate?: string): TripDraft {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const start = startDate ? new Date(startDate) : new Date();

  const dayMatches = [...lower.matchAll(/(\d+)\s*tage?/g)].map((m) =>
    parseInt(m[1], 10)
  );

  const segments = splitSegments(lower);
  const legs: LegInput[] = [];
  let cursor = startOfDay(start);

  if (segments.length > 0) {
    segments.forEach((seg, idx) => {
      const days = extractDays(seg) || dayMatches[idx] || 5;
      const end = addDays(cursor, days - 1);
      legs.push(buildLegFromSegment(seg, cursor, end, idx));
      cursor = addDays(end, 1);
    });
  } else {
    const days = dayMatches[0] || 7;
    const end = addDays(cursor, days - 1);
    legs.push(buildLegFromSegment(lower, cursor, end, 0));
    cursor = addDays(end, 1);
  }

  const title = deriveTitle(lower, legs);
  return {
    title,
    startDate: iso(start),
    endDate: iso(addDays(cursor, -1)),
    legs,
  };
}

function splitSegments(text: string): string[] {
  const parts = text
    .split(/\b(?:danach|dann|anschließend|then|followed by|after that|, dann)\b/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : text ? [text] : [];
}

function extractDays(seg: string): number | null {
  const m = seg.match(/(\d+)\s*tage?/);
  return m ? parseInt(m[1], 10) : null;
}

function buildLegFromSegment(
  seg: string,
  start: Date,
  end: Date,
  idx: number
): LegInput {
  const transport = detectTransport(seg);
  const laundryAvailable = /mit wäsche|waschmaschine|laundry|waschsalon/i.test(
    seg
  );
  const noLaundry = /ohne wäsche|ohne wasch|no laundry|keine wäsche/i.test(seg);

  const weatherTags: WeatherTag[] = [];
  if (/atlantik|atlantic|windig|kühl|cool|deck|oktober|october|herbst/i.test(seg)) {
    weatherTags.push("cool_windy");
  }
  if (/ungewiss|variabel|wechselhaft|uncertain/i.test(seg)) {
    weatherTags.push("uncertain");
  }
  if (/tropisch|florida|karibik|caribbean|heiß|hot|strand|beach/i.test(seg)) {
    weatherTags.push("tropical", "hot");
  }
  if (/regen|rain/i.test(seg)) weatherTags.push("rainy");
  if (/kalt|cold|winter/i.test(seg)) weatherTags.push("cold");
  if (!weatherTags.length) weatherTags.push("uncertain");

  const dressCodes: DressCode[] = ["casual"];
  if (/gala|formal|abend|dress code|elegant/i.test(seg)) dressCodes.push("gala");
  if (/sport|hike|wandern|fitness/i.test(seg)) dressCodes.push("sport");
  if (/smart|business casual/i.test(seg)) dressCodes.push("smart_casual");

  return {
    name: deriveLegName(seg, transport, idx),
    startDate: iso(start),
    endDate: iso(end),
    transport,
    laundryAvailable: laundryAvailable && !noLaundry,
    laundryIntervalDays: laundryAvailable ? 3 : null,
    weatherTags,
    dressCodes,
  };
}

function detectTransport(seg: string): Transport {
  if (/kreuzfahrt|schiff|cruise|atlantik|transatlantik|ferry/i.test(seg))
    return "SHIP";
  if (/flug|flight|fliegen|airport/i.test(seg)) return "FLIGHT";
  if (/roadtrip|auto|mietwagen|drive|car/i.test(seg)) return "CAR";
  if (/zug|train|bahn/i.test(seg)) return "TRAIN";
  return "OTHER";
}

function deriveLegName(seg: string, transport: Transport, idx: number): string {
  if (/transatlantik|atlantic/i.test(seg)) return "Transatlantik";
  if (/florida/i.test(seg)) return "Florida";
  if (/kreuzfahrt|cruise/i.test(seg)) return "Kreuzfahrt";
  if (/karibik|caribbean/i.test(seg)) return "Karibik";
  if (/roadtrip/i.test(seg)) return "Roadtrip-Etappe";
  const labels: Record<Transport, string> = {
    SHIP: "Schiffs-Etappe",
    FLIGHT: "Flug-Etappe",
    CAR: "Auto-Etappe",
    TRAIN: "Zug-Etappe",
    OTHER: `Etappe ${idx + 1}`,
  };
  return labels[transport];
}

function deriveTitle(text: string, legs: LegInput[]): string {
  if (/transatlantik|atlantic/i.test(text)) return "Transatlantik-Reise";
  if (/kreuzfahrt|cruise/i.test(text)) return "Kreuzfahrt";
  if (/roadtrip/i.test(text)) return "Roadtrip";
  if (legs.length > 1) return `Multi-Etappen Reise (${legs.length} Legs)`;
  return legs[0]?.name || "Neue Reise";
}
