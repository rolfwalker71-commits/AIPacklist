/** Rough destination regions for legs — used by UI presets and AI context. */
export const LOCATION_PRESETS = [
  "Florida",
  "Europa",
  "Karibik",
  "Transatlantik",
  "Mittelmeer",
  "USA Ostküste",
  "USA Westküste",
  "Asien",
  "Nahost",
  "Nordafrika",
  "Skandinavien",
  "Alpen",
] as const;

export type LocationPreset = (typeof LOCATION_PRESETS)[number];
