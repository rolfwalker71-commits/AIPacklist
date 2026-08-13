export type PackPriority = "EARLY" | "NORMAL" | "DAY_OF";

const EARLY_PATTERNS = [
  "esta",
  "eta",
  "evisa",
  "e-visa",
  "visa",
  "visum",
  "einreiseformular",
  "einreise",
  "impfung",
  "impfpass",
  "impfausweis",
  "versicherung",
  "auslandskrank",
  "krankenversicherung",
  "formular",
  "genehmigung",
  "antrag",
  "termin",
  "rezept",
  "medikamente bestellen",
  "reisepass beantragen",
  "passfoto",
  "fototermin",
  "covid",
  "pcr",
  "gelbfieber",
];

const DAY_OF_PATTERNS = [
  "bordkarte",
  "boarding",
  "schlüssel",
  "hausschlüssel",
  "geldbörse",
  "geldboerse",
  "portemonnaie",
  "wallet",
  "taschengeld",
  "wasserflasche",
  "snacks für unterwegs",
  "unterwegs",
  "am reisetag",
  "kurz vor",
  "check-in online",
];

export function priorityRank(p: PackPriority): number {
  if (p === "EARLY") return 0;
  if (p === "DAY_OF") return 2;
  return 1;
}

export function priorityLabel(p: PackPriority): string | null {
  if (p === "EARLY") return "Früh erledigen";
  if (p === "DAY_OF") return "Am Reisetag";
  return null;
}

/** Prefer the more time-sensitive of two priorities. */
export function mergePriority(a: PackPriority, b: PackPriority): PackPriority {
  return priorityRank(a) <= priorityRank(b) ? a : b;
}

export function inferPriority(
  name: string,
  category?: string | null,
  notes?: string | null
): PackPriority {
  const hay = `${name} ${category || ""} ${notes || ""}`.toLowerCase();

  if (EARLY_PATTERNS.some((k) => hay.includes(k))) return "EARLY";
  if (DAY_OF_PATTERNS.some((k) => hay.includes(k))) return "DAY_OF";

  // Tickets often need advance download / printing — mild early
  if (
    category?.toLowerCase() === "dokumente" &&
    (hay.includes("ticket") || hay.includes("pass") || hay.includes("ausweis"))
  ) {
    // Bordkarte alone is day-of; pass/tickets are early-ish prep
    if (hay.includes("bordkarte") || hay.includes("boarding")) return "DAY_OF";
    return "EARLY";
  }

  return "NORMAL";
}

export function resolvePriority(item: {
  name: string;
  category?: string | null;
  notes?: string | null;
  priority?: PackPriority | string | null;
}): PackPriority {
  const stored = normalizePriority(item.priority);
  const inferred = inferPriority(item.name, item.category, item.notes);
  return mergePriority(stored, inferred);
}

export function normalizePriority(
  value: string | null | undefined
): PackPriority {
  if (value === "EARLY" || value === "DAY_OF" || value === "NORMAL") return value;
  return "NORMAL";
}

export function parseAiPriority(value: unknown): PackPriority | null {
  if (typeof value !== "string") return null;
  const v = value.toUpperCase().replace(/-/g, "_");
  if (v === "EARLY" || v === "FRUEH" || v === "EARLY_PREP") return "EARLY";
  if (v === "DAY_OF" || v === "LAST" || v === "REISETAG") return "DAY_OF";
  if (v === "NORMAL") return "NORMAL";
  return null;
}
