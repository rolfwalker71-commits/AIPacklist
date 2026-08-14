import type { WeatherTag } from "@/lib/types";

export type WeatherSummary = {
  label: string;
  tMin: number | null;
  tMax: number | null;
  rainMm: number | null;
  fetchedAt: string;
  lat: number;
  lon: number;
  placeName?: string;
};

type GeoHit = {
  latitude: number;
  longitude: number;
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  population?: number;
  feature_code?: string;
};

const geoCache = new Map<string, GeoHit | null>();

/**
 * Open-Meteo has no reliable “US state Florida” hit — bare “Florida” ranks
 * Floridablanca (CO) first, and “Florida USA” often returns nothing.
 * Map travel presets / ambiguous regions to a concrete forecast point.
 */
const LOCATION_ALIASES: Record<string, string> = {
  florida: "Orlando, Florida",
  "florida usa": "Orlando, Florida",
  "florida, usa": "Orlando, Florida",
  "florida us": "Orlando, Florida",
  "florida, us": "Orlando, Florida",
  "florida united states": "Orlando, Florida",
  "florida, united states": "Orlando, Florida",
  "usa ostküste": "New York",
  "usa ostkueste": "New York",
  "usa westküste": "Los Angeles",
  "usa westkueste": "Los Angeles",
  karibik: "San Juan, Puerto Rico",
  mittelmeer: "Barcelona",
  skandinavien: "Stockholm",
  europa: "Berlin",
  asien: "Bangkok",
  nahost: "Dubai",
  nordafrika: "Marrakesch",
  alpen: "Innsbruck",
  transatlantik: "New York",
};

const COUNTRY_HINTS: { re: RegExp; code: string }[] = [
  {
    re: /\b(usa|u\.s\.a\.|u\.s\.|united states|vereinigte staaten)\b/i,
    code: "US",
  },
  { re: /\b(uk|united kingdom|grossbritannien|großbritannien)\b/i, code: "GB" },
  { re: /\b(deutschland|germany)\b/i, code: "DE" },
  { re: /\b(schweiz|switzerland)\b/i, code: "CH" },
  { re: /\b(österreich|oesterreich|austria)\b/i, code: "AT" },
  { re: /\b(frankreich|france)\b/i, code: "FR" },
  { re: /\b(italien|italy)\b/i, code: "IT" },
  { re: /\b(spanien|spain)\b/i, code: "ES" },
];

function normalizeKey(location: string) {
  return location
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function resolveAlias(location: string): string {
  const key = normalizeKey(location);
  return LOCATION_ALIASES[key] || location.trim();
}

function parseCountryHint(location: string): {
  query: string;
  countryCode: string | null;
} {
  let countryCode: string | null = null;
  let query = location.trim();
  for (const hint of COUNTRY_HINTS) {
    if (hint.re.test(query)) {
      countryCode = hint.code;
      query = query.replace(hint.re, "").replace(/[,\s]+$/g, "").trim();
      // "Florida, USA" → "Florida"; keep commas clean
      query = query.replace(/,\s*$/, "").trim();
      break;
    }
  }
  return { query: query || location.trim(), countryCode };
}

function scoreHit(
  hit: GeoHit,
  query: string,
  countryCode: string | null
): number {
  const q = query.trim().toLowerCase();
  const name = (hit.name || "").toLowerCase();
  const admin1 = (hit.admin1 || "").toLowerCase();
  let score = Math.log10((hit.population || 0) + 10);

  if (countryCode && hit.country_code === countryCode) score += 50;
  else if (countryCode && hit.country_code && hit.country_code !== countryCode)
    score -= 40;

  if (name === q) score += 30;
  else if (name.startsWith(q)) score += 12;
  else if (name.includes(q)) score += 4;

  // Prefer places that sit in a region matching the query (e.g. Miami in Florida)
  if (admin1 === q) score += 25;

  // Prefer cities over tiny populated places when names collide
  const fc = hit.feature_code || "";
  if (fc.startsWith("PPLA")) score += 8;
  if (fc === "PPL" && (hit.population || 0) < 5000) score -= 5;

  return score;
}

async function geocodeSearch(
  name: string,
  countryCode: string | null
): Promise<GeoHit[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "de");
  url.searchParams.set("format", "json");
  if (countryCode) url.searchParams.set("countryCode", countryCode);

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: GeoHit[] };
  return data.results || [];
}

function buildSearchPlan(location: string): {
  searchName: string;
  countryCode: string | null;
  scoreQuery: string;
} {
  const { query, countryCode } = parseCountryHint(location);

  // Full string or stripped query → alias (Florida / Florida USA → Orlando)
  for (const candidate of [location.trim(), query, countryCode === "US" ? `${query} USA` : ""]) {
    if (!candidate) continue;
    const alias = resolveAlias(candidate);
    if (alias !== candidate.trim()) {
      return {
        searchName: alias,
        countryCode,
        scoreQuery: alias,
      };
    }
  }

  return { searchName: query, countryCode, scoreQuery: query };
}

async function geocode(location: string): Promise<GeoHit | null> {
  const cacheKey = normalizeKey(location);
  if (!cacheKey) return null;
  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey) ?? null;

  try {
    const plan = buildSearchPlan(location);
    let results = await geocodeSearch(plan.searchName, plan.countryCode);
    if (!results.length && plan.countryCode) {
      results = await geocodeSearch(plan.searchName, null);
    }
    if (!results.length && plan.searchName !== location.trim()) {
      results = await geocodeSearch(location.trim(), plan.countryCode);
    }

    if (!results.length) {
      geoCache.set(cacheKey, null);
      return null;
    }

    const ranked = [...results].sort(
      (a, b) =>
        scoreHit(b, plan.scoreQuery, plan.countryCode) -
        scoreHit(a, plan.scoreQuery, plan.countryCode)
    );
    const hit = ranked[0] ?? null;
    geoCache.set(cacheKey, hit);
    return hit;
  } catch {
    geoCache.set(cacheKey, null);
    return null;
  }
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Map daily forecast averages to FlexiPack weather tags. */
export function tagsFromForecast(opts: {
  tMin: number | null;
  tMax: number | null;
  rainMm: number | null;
}): WeatherTag[] {
  const tags = new Set<WeatherTag>();
  const { tMin, tMax, rainMm } = opts;

  if (tMax == null && tMin == null) {
    tags.add("uncertain");
    return [...tags];
  }

  const mid =
    tMax != null && tMin != null
      ? (tMax + tMin) / 2
      : (tMax ?? tMin ?? 15);

  if (mid >= 28) tags.add("hot");
  else if (mid >= 24) tags.add("tropical");
  else if (mid <= 5) tags.add("cold");
  else if (mid <= 14) tags.add("cool_windy");

  if (rainMm != null && rainMm >= 5) tags.add("rainy");
  if (tags.size === 0) tags.add("uncertain");

  return [...tags];
}

function buildLabel(opts: {
  tMin: number | null;
  tMax: number | null;
  rainMm: number | null;
  placeName?: string;
}) {
  const parts: string[] = [];
  if (opts.tMin != null && opts.tMax != null) {
    parts.push(`${Math.round(opts.tMin)}–${Math.round(opts.tMax)} °C`);
  } else if (opts.tMax != null) {
    parts.push(`bis ${Math.round(opts.tMax)} °C`);
  }
  if (opts.rainMm != null && opts.rainMm >= 1) {
    parts.push(
      opts.rainMm >= 5 ? "Regen möglich" : "leichter Niederschlag möglich"
    );
  } else if (opts.rainMm != null) {
    parts.push("eher trocken");
  }
  const core = parts.join(" · ") || "Keine Prognose";
  return opts.placeName ? `${opts.placeName}: ${core}` : core;
}

/**
 * Fetch Open-Meteo daily forecast for a leg's location and date range.
 * Dates beyond the free forecast window fall back to the available days.
 */
export async function fetchLegWeather(opts: {
  location: string;
  startDate: Date;
  endDate: Date;
}): Promise<{
  summary: WeatherSummary;
  tags: WeatherTag[];
} | null> {
  const geo = await geocode(opts.location);
  if (!geo) return null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const maxEnd = new Date(today);
  maxEnd.setUTCDate(maxEnd.getUTCDate() + 15);

  let start = opts.startDate < today ? today : opts.startDate;
  let end = opts.endDate > maxEnd ? maxEnd : opts.endDate;
  if (end < start) {
    start = today;
    end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 3);
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(geo.latitude));
  url.searchParams.set("longitude", String(geo.longitude));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum"
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", toIsoDate(start));
  url.searchParams.set("end_date", toIsoDate(end));

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    daily?: {
      temperature_2m_max?: (number | null)[];
      temperature_2m_min?: (number | null)[];
      precipitation_sum?: (number | null)[];
    };
  };

  const maxes = (data.daily?.temperature_2m_max || []).filter(
    (n): n is number => typeof n === "number"
  );
  const mins = (data.daily?.temperature_2m_min || []).filter(
    (n): n is number => typeof n === "number"
  );
  const rains = (data.daily?.precipitation_sum || []).filter(
    (n): n is number => typeof n === "number"
  );

  const tMax = maxes.length ? Math.max(...maxes) : null;
  const tMin = mins.length ? Math.min(...mins) : null;
  const rainMm = rains.length
    ? rains.reduce((a, b) => a + b, 0) / rains.length
    : null;

  const placeName = [
    geo.name,
    geo.admin1 && geo.admin1 !== geo.name ? geo.admin1 : null,
    geo.country,
  ]
    .filter(Boolean)
    .join(", ");
  const tags = tagsFromForecast({ tMin, tMax, rainMm });
  const summary: WeatherSummary = {
    label: buildLabel({ tMin, tMax, rainMm, placeName }),
    tMin,
    tMax,
    rainMm,
    fetchedAt: new Date().toISOString(),
    lat: geo.latitude,
    lon: geo.longitude,
    placeName,
  };

  return { summary, tags };
}

export function parseWeatherSummary(
  raw: string | null | undefined
): WeatherSummary | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as WeatherSummary;
    if (!v || typeof v.label !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

export const WEATHER_TAG_LABELS: Record<WeatherTag, string> = {
  cool_windy: "Kühl / windig",
  tropical: "Tropisch",
  uncertain: "Ungewiss",
  cold: "Kalt",
  hot: "Heiss",
  rainy: "Regen",
};
