/**
 * Dedupe helpers for pack items — exact and near-duplicate names
 * (Pass/Reisepass, T-Shirt/Shirts, Singular/Plural).
 */

export type DedupeItem = {
  name: string;
  isShared?: boolean;
  notes?: string | null;
  assigneeKey?: string | null;
};

/** Strip noise so «Reisepass (gültig)» ≈ «Pass». */
export function normalizePackName(name: string): string {
  let s = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/\(.*?\)/g, " ")
    .replace(/für\s+[\wÄÖÜäöüß.-]+/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(x|stk|stueck|stuck|paar|set|ca|etwa|inkl|optional|neu|extra)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  // Light plural / compound cleanup
  const aliases: [RegExp, string][] = [
    [/\breisepass\b/g, "pass"],
    [/\bpersonalausweis\b/g, "pass"],
    [/\bausweis\b/g, "pass"],
    [/\bid\s*karte\b/g, "pass"],
    [/\bpassport\b/g, "pass"],
    [/\bt[\s-]?shirts?\b/g, "tshirt"],
    [/\bshirts?\b/g, "tshirt"],
    [/\boberteile?\b/g, "tshirt"],
    [/\bunterwaesche\b/g, "unterwaesche"],
    [/\bslips?\b/g, "unterwaesche"],
    [/\bboxershorts?\b/g, "unterwaesche"],
    [/\bbhs?\b/g, "unterwaesche"],
    [/\bsocken\b/g, "socken"],
    [/\bsocke\b/g, "socken"],
    [/\bsocks\b/g, "socken"],
    [/\bzahnbuerste\b/g, "zahnbuerste"],
    [/\bzahnputz\w*\b/g, "zahnbuerste"],
    [/\bladekabel\b/g, "ladekabel"],
    [/\busb[\s-]?kabel\b/g, "ladekabel"],
    [/\bhandy[\s-]?lad\w*\b/g, "ladekabel"],
    [/\bnetzteil\b/g, "netzteil"],
    [/\bladegeraet\b/g, "netzteil"],
    [/\bpowerbank\b/g, "powerbank"],
    [/\bsonnencreme\b/g, "sonnencreme"],
    [/\bsonnenschutz\b/g, "sonnencreme"],
    [/\bsunscreen\b/g, "sonnencreme"],
    [/\bregenjacke\b/g, "regenjacke"],
    [/\bregenmantel\b/g, "regenjacke"],
    [/\bregenschirm\b/g, "regenschirm"],
    [/\bschirm\b/g, "regenschirm"],
    [/\bmedikamente?\b/g, "medikamente"],
    [/\breiseapotheke\b/g, "medikamente"],
    [/\berste[\s-]?hilfe\b/g, "medikamente"],
    [/\bhose\b/g, "hose"],
    [/\bhosen\b/g, "hose"],
    [/\bshorts?\b/g, "shorts"],
    [/\bbadehose\b/g, "badehose"],
    [/\bbadeanzug\b/g, "badehose"],
    [/\bbikini\b/g, "badehose"],
    [/\badapter\b/g, "adapter"],
    [/\breiseadapter\b/g, "adapter"],
    [/\bsteckadapter\b/g, "adapter"],
  ];
  for (const [re, rep] of aliases) {
    s = s.replace(re, rep);
  }

  if (s.endsWith("en") && s.length > 6) s = s.slice(0, -2);
  else if (s.endsWith("s") && s.length > 4 && !s.endsWith("ss")) {
    s = s.slice(0, -1);
  }

  return s.replace(/\s+/g, " ").trim();
}

function ownerKey(item: DedupeItem): string {
  if (item.isShared) return "shared";
  if (item.assigneeKey && item.assigneeKey !== "shared") {
    return `u:${item.assigneeKey.toLowerCase()}`;
  }
  const m = item.notes?.match(/für\s+([^·,/]+)/i);
  if (m) return `n:${m[1].trim().toLowerCase()}`;
  return "personal";
}

function tokenSet(normalized: string): Set<string> {
  return new Set(
    normalized
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
  );
}

/** True if two names mean the same pack position. */
export function packNamesSimilar(a: string, b: string): boolean {
  const na = normalizePackName(a);
  const nb = normalizePackName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;

  const ta = tokenSet(na);
  const tb = tokenSet(nb);
  if (ta.size === 0 || tb.size === 0) return false;

  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  if (inter === 0) return false;

  const union = ta.size + tb.size - inter;
  if (inter / union >= 0.66) return true;

  // Single distinctive token match (e.g. both normalize to "pass")
  if (inter >= 1 && (ta.size === 1 || tb.size === 1)) return true;

  return false;
}

/** Same owner (person / shared) and similar name → duplicate. */
export function isDuplicatePackItem(
  candidate: DedupeItem,
  existing: DedupeItem[]
): boolean {
  const who = ownerKey(candidate);
  for (const ex of existing) {
    if (ownerKey(ex) !== who) continue;
    if (packNamesSimilar(candidate.name, ex.name)) return true;
  }
  return false;
}

/** Filter AI/calculator suggestions against an existing list (and within batch). */
export function filterNewPackItems<T extends DedupeItem>(
  candidates: T[],
  existing: DedupeItem[]
): T[] {
  const accepted: T[] = [];
  const pool: DedupeItem[] = [...existing];
  for (const c of candidates) {
    if (isDuplicatePackItem(c, pool)) continue;
    accepted.push(c);
    pool.push(c);
  }
  return accepted;
}
