import type { SuitcaseSize } from "./suitcases";
import { SUITCASE_SIZES } from "./suitcases";

/** Soft item-slot capacity — used for AI pre-assignment and overload hints. */
export const SUITCASE_SOFT_CAPACITY: Record<
  SuitcaseSize,
  { maxItems: number; maxKgHint: number }
> = {
  CABIN: { maxItems: 22, maxKgHint: 10 },
  MEDIUM: { maxItems: 40, maxKgHint: 23 },
  LARGE: { maxItems: 55, maxKgHint: 28 },
  XL: { maxItems: 75, maxKgHint: 32 },
};

export function softCapacityFor(size: string): number {
  const key = size as SuitcaseSize;
  return SUITCASE_SOFT_CAPACITY[key]?.maxItems ?? 40;
}

export type BagForAssign = {
  id: string;
  name: string;
  size: string;
  isShared: boolean;
  ownerUserId: string | null;
};

export type ItemForAssign = {
  id?: string;
  name: string;
  quantity: number;
  isShared: boolean;
  assigneeKey?: string | null;
  notes?: string | null;
  category?: string;
  /** Preferred suitcase id from AI, if any */
  preferredSuitcaseId?: string | null;
};

function ownerFromNotes(notes?: string | null): string | null {
  const m = notes?.match(/für\s+([^·]+)/i);
  return m ? m[1].trim().toLowerCase() : null;
}

/**
 * Pick a suitcase for one item given current fill levels.
 * Prefers preferred id, then owner/shared match, then least-full fitting bag.
 */
export function pickSuitcaseForItem(
  item: ItemForAssign,
  bags: BagForAssign[],
  fill: Map<string, number>,
  travelerNameByKey: Map<string, string>
): string | null {
  if (!bags.length) return null;

  const qty = Math.max(1, item.quantity || 1);
  const preferred = item.preferredSuitcaseId
    ? bags.find((b) => b.id === item.preferredSuitcaseId)
    : null;
  if (preferred) {
    fill.set(preferred.id, (fill.get(preferred.id) || 0) + qty);
    return preferred.id;
  }

  const noteOwner = ownerFromNotes(item.notes);
  const assigneeName = item.assigneeKey
    ? travelerNameByKey.get(item.assigneeKey)?.toLowerCase()
    : null;

  let candidates = bags;
  if (item.isShared) {
    const shared = bags.filter((b) => b.isShared);
    if (shared.length) candidates = shared;
  } else {
    const ownerId = item.assigneeKey || null;
    const personal = bags.filter(
      (b) =>
        !b.isShared &&
        (b.ownerUserId === ownerId ||
          (noteOwner &&
            travelerNameByKey.get(b.ownerUserId || "")?.toLowerCase() ===
              noteOwner) ||
          (assigneeName &&
            travelerNameByKey.get(b.ownerUserId || "")?.toLowerCase() ===
              assigneeName))
    );
    if (personal.length) candidates = personal;
    else {
      const nonShared = bags.filter((b) => !b.isShared);
      if (nonShared.length) candidates = nonShared;
    }
  }

  // Prefer bags still under soft capacity, then least full
  const ranked = [...candidates].sort((a, b) => {
    const fa = fill.get(a.id) || 0;
    const fb = fill.get(b.id) || 0;
    const ca = softCapacityFor(a.size);
    const cb = softCapacityFor(b.size);
    const oa = fa + qty > ca ? 1 : 0;
    const ob = fb + qty > cb ? 1 : 0;
    if (oa !== ob) return oa - ob;
    const ra = fa / ca;
    const rb = fb / cb;
    if (ra !== rb) return ra - rb;
    return fa - fb;
  });

  const chosen = ranked[0];
  fill.set(chosen.id, (fill.get(chosen.id) || 0) + qty);
  return chosen.id;
}

export type CapacityWarning = {
  suitcaseId: string;
  name: string;
  size: string;
  itemCount: number;
  softMax: number;
  overBy: number;
};

export function analyzeCapacity(
  bags: BagForAssign[],
  itemCounts: Map<string, number>
): { warnings: CapacityWarning[]; summary: string | null } {
  const warnings: CapacityWarning[] = [];
  let totalItems = 0;
  let totalSoft = 0;

  for (const bag of bags) {
    const count = itemCounts.get(bag.id) || 0;
    const softMax = softCapacityFor(bag.size);
    totalItems += count;
    totalSoft += softMax;
    if (count > softMax) {
      warnings.push({
        suitcaseId: bag.id,
        name: bag.name,
        size: bag.size,
        itemCount: count,
        softMax,
        overBy: count - softMax,
      });
    }
  }

  let summary: string | null = null;
  if (warnings.length) {
    summary = warnings
      .map(
        (w) =>
          `«${w.name}» (${SUITCASE_SIZES.find((s) => s.id === w.size)?.label || w.size}): ${w.itemCount} Positionen, Soft-Limit ~${w.softMax} (+${w.overBy}).`
      )
      .join(" ");
    summary +=
      " Evtl. Koffer hinzufügen, Grösse erhöhen oder Items umverteilen.";
  } else if (bags.length && totalItems > totalSoft * 0.9) {
    summary = `Die Koffer sind knapp belegt (${totalItems} Positionen bei Soft-Kapazität ~${totalSoft}). Ein zusätzlicher Koffer könnte helfen.`;
  }

  return { warnings, summary };
}

/** Assign many new items starting from current bag fill. */
export function assignNewItems(
  items: ItemForAssign[],
  bags: BagForAssign[],
  currentCounts: Map<string, number>,
  travelers: { key: string; name: string }[]
): { suitcaseIdByIndex: (string | null)[]; fill: Map<string, number> } {
  const fill = new Map(currentCounts);
  const travelerNameByKey = new Map(
    travelers.map((t) => [t.key, t.name] as const)
  );
  // also map userId -> name for owner lookup
  for (const t of travelers) {
    travelerNameByKey.set(t.key, t.name);
  }

  const suitcaseIdByIndex = items.map((item) =>
    pickSuitcaseForItem(item, bags, fill, travelerNameByKey)
  );
  return { suitcaseIdByIndex, fill };
}
