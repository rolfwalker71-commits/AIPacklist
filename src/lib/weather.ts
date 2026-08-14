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
};

const geoCache = new Map<string, GeoHit | null>();

async function geocode(location: string): Promise<GeoHit | null> {
  const key = location.trim().toLowerCase();
  if (!key) return null;
  if (geoCache.has(key)) return geoCache.get(key) ?? null;

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", location.trim());
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "de");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) {
      geoCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as { results?: GeoHit[] };
    const hit = data.results?.[0] ?? null;
    geoCache.set(key, hit);
    return hit;
  } catch {
    geoCache.set(key, null);
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
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
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

  const placeName = [geo.name, geo.country].filter(Boolean).join(", ");
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
