import { normalizePackName, packNamesSimilar } from "./pack-dedupe";
import type { CalculatedItem, PackGender, TravelerProfile } from "./types";

/** Never shared — one physical thing per person. */
const UNIT_PERSONAL = [
  "reisepass",
  "ausweis",
  "pass",
  "esta",
  "eta",
  "visa",
  "ticket",
  "bordkarte",
  "zahnbuerste",
  "zahnbürste",
  "powerbank",
  "ladekabel",
  "netzteil",
  "handy-lad",
  "medikament",
  "rasier",
  "einreiseformular",
];

const FEMALE_ONLY = [
  "bh",
  "bhs",
  "slip",
  "abendkleid",
  "cocktailkleid",
  "pumps",
  "bikini",
  "badeanzug",
  "monatshygiene",
  "haarpflege",
  "bluse",
];

const MALE_ONLY = [
  "boxershort",
  "anzug",
  "smoking",
  "krawatte",
  "fliege",
  "rasier",
  "badehose",
];

const PERSONAL_CATEGORIES = new Set([
  "Kleidung",
  "Schuhe",
  "Festlich",
  "Dokumente",
  "Aktivität",
]);

function hay(name: string, extra = "") {
  return `${name} ${extra}`
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss");
}

export function isUnitPersonalItem(name: string): boolean {
  const n = hay(name);
  return UNIT_PERSONAL.some((k) => n.includes(hay(k)));
}

export function isAlwaysPersonalItem(name: string, category?: string): boolean {
  if (isUnitPersonalItem(name)) return true;
  if (category && PERSONAL_CATEGORIES.has(category)) return true;
  const n = hay(name);
  if (/\b(t-?shirt|unterwaesche|socken|hose|jeans|schuhe)\b/.test(n)) {
    return true;
  }
  return false;
}

function genderGate(name: string): PackGender | null {
  const n = hay(name);
  const female = FEMALE_ONLY.some((k) => n.includes(hay(k)));
  const male = MALE_ONLY.some((k) => n.includes(hay(k)));
  if (female && male) return null;
  if (female) return "FEMALE";
  if (male) return "MALE";
  return null;
}

export function isMixedGenderClothing(name: string): boolean {
  const n = hay(name);
  if (n.includes("abendgarderobe")) return true;
  const female = FEMALE_ONLY.some((k) => n.includes(hay(k)));
  const male = MALE_ONLY.some((k) => n.includes(hay(k)));
  return female && male;
}

export function isEveningWearItem(name: string): boolean {
  const n = hay(name);
  return (
    n.includes("abendkleid") ||
    n.includes("cocktailkleid") ||
    n.includes("abendgarderobe") ||
    n.includes("smoking") ||
    (n.includes("anzug") &&
      (n.includes("abend") || n.includes("gala") || n.includes("festlich")))
  );
}

export function clothingNameForGender(
  name: string,
  gender: PackGender | string | undefined
): string {
  const g = (gender || "UNSPECIFIED") as PackGender;
  if (isEveningWearItem(name) || isMixedGenderClothing(name)) {
    if (g === "FEMALE") return "Abendkleid / Cocktailkleid";
    if (g === "MALE") return "Anzug / Smoking";
  }
  return name;
}

export function travelerFitsItemGender(
  gender: PackGender | string | undefined,
  name: string
): boolean {
  const gate = genderGate(name);
  if (!gate) return true;
  const g = (gender || "UNSPECIFIED") as PackGender;
  if (g === "UNSPECIFIED") return true;
  return g === gate;
}

function travelerFitsItem(t: TravelerProfile, name: string): boolean {
  return travelerFitsItemGender(t.gender, name);
}

export function stripOwnerFromNotes(notes?: string | null): string {
  return (notes || "")
    .replace(/für\s+[^·]+/gi, "")
    .replace(/^[\s·,/-]+/, "")
    .trim();
}

function notesFor(traveler: TravelerProfile, extra?: string | null): string {
  const rest = stripOwnerFromNotes(extra);
  return rest ? `für ${traveler.name} · ${rest}` : `für ${traveler.name}`;
}

export function notesWithOwner(
  notes: string | null | undefined,
  ownerName: string | null
): string | null {
  const rest = stripOwnerFromNotes(notes);
  if (ownerName) return rest ? `für ${ownerName} · ${rest}` : `für ${ownerName}`;
  return rest || null;
}

export function matchTravelerByHint(
  hint: string | null | undefined,
  travelers: TravelerProfile[]
): TravelerProfile | undefined {
  const h = String(hint || "").trim().toLowerCase();
  if (!h) return undefined;
  const exact = travelers.filter((t) => t.name.toLowerCase() === h);
  if (exact.length === 1) return exact[0];
  const first = travelers.filter(
    (t) => t.name.toLowerCase().split(/\s+/)[0] === h
  );
  if (first.length === 1) return first[0];
  const contains = travelers.filter((t) => {
    const n = t.name.toLowerCase();
    return n.includes(h) || h.includes(n);
  });
  if (contains.length === 1) return contains[0];
  return undefined;
}

export function matchTravelerFromAi(
  raw: { forTravelerId?: string | null; forTraveler?: string | null },
  travelers: TravelerProfile[]
): TravelerProfile | undefined {
  const id = String(raw.forTravelerId || "").trim();
  if (id) {
    const byId = travelers.find((t) => t.key === id);
    if (byId) return byId;
  }
  return matchTravelerByHint(raw.forTraveler, travelers);
}

export function ownerUserIdFromCalc(
  item: Pick<CalculatedItem, "isShared" | "assigneeKey">
): string | null {
  if (item.isShared) return null;
  const key = item.assigneeKey;
  if (!key || key === "shared" || key === "partner-pending" || key === "traveler-1") {
    return null;
  }
  return key;
}

export type PackOwnerResolution =
  | { kind: "shared" }
  | { kind: "user"; userId: string }
  | { kind: "unassigned" };

export type PackOwnerMember = { id: string; name: string };
export type PackOwnerBag = {
  id: string;
  isShared: boolean;
  ownerUserId: string | null;
};

function ownerFromNotes(
  notes: string | null | undefined,
  members: PackOwnerMember[]
): string | null {
  const fromNote = ownerNameFromNotes(notes);
  if (!fromNote) return null;
  const match = matchTravelerByHint(
    fromNote,
    members.map((m) => ({
      key: m.id,
      name: m.name,
      gender: "UNSPECIFIED" as const,
    }))
  );
  return match?.key || null;
}

function ownerFromSuitcase(
  item: {
    suitcaseId?: string | null;
    suitcase?: {
      id?: string;
      isShared?: boolean;
      ownerUserId?: string | null;
    } | null;
  },
  ctx: { members: PackOwnerMember[]; suitcases?: PackOwnerBag[] }
): string | null {
  const memberIds = new Set(ctx.members.map((m) => m.id));
  const bag =
    (item.suitcaseId && ctx.suitcases
      ? ctx.suitcases.find((s) => s.id === item.suitcaseId)
      : undefined) ||
    (item.suitcase?.id && ctx.suitcases
      ? ctx.suitcases.find((s) => s.id === item.suitcase?.id)
      : undefined) ||
    (item.suitcase
      ? {
          id: item.suitcase.id || "",
          isShared: Boolean(item.suitcase.isShared),
          ownerUserId: item.suitcase.ownerUserId ?? null,
        }
      : undefined);

  if (bag && !bag.isShared && bag.ownerUserId && memberIds.has(bag.ownerUserId)) {
    return bag.ownerUserId;
  }
  return null;
}

/** Display/grouping: persisted owner first, notes only as legacy hint. Never suitcase. */
export function resolvePackOwnerId(
  item: {
    isShared?: boolean;
    ownerUserId?: string | null;
    notes?: string | null;
  },
  ctx: {
    members: PackOwnerMember[];
    suitcases?: PackOwnerBag[];
  }
): PackOwnerResolution {
  if (item.isShared) return { kind: "shared" };

  const memberIds = new Set(ctx.members.map((m) => m.id));
  if (item.ownerUserId && memberIds.has(item.ownerUserId)) {
    return { kind: "user", userId: item.ownerUserId };
  }

  const fromNote = ownerFromNotes(item.notes, ctx.members);
  if (fromNote) return { kind: "user", userId: fromNote };

  return { kind: "unassigned" };
}

/** One-time backfill for rows created before ownerUserId existed. */
export function inferOwnerUserId(
  item: {
    isShared?: boolean;
    ownerUserId?: string | null;
    notes?: string | null;
    suitcaseId?: string | null;
    suitcase?: {
      id?: string;
      isShared?: boolean;
      ownerUserId?: string | null;
    } | null;
  },
  ctx: {
    members: PackOwnerMember[];
    suitcases?: PackOwnerBag[];
  }
): string | null {
  if (item.isShared) return null;
  const memberIds = new Set(ctx.members.map((m) => m.id));
  if (item.ownerUserId && memberIds.has(item.ownerUserId)) {
    return item.ownerUserId;
  }
  return (
    ownerFromNotes(item.notes, ctx.members) ||
    ownerFromSuitcase(item, ctx) ||
    (ctx.members.length === 1 ? ctx.members[0].id : null)
  );
}

function cloneForTraveler(
  item: CalculatedItem,
  traveler: TravelerProfile,
  quantity: number
): CalculatedItem {
  return {
    ...item,
    quantity,
    isShared: false,
    assigneeKey: traveler.key,
    notes: notesFor(traveler, item.notes),
  };
}

/**
 * KI stapelt oft «Zahnbürste ×2» auf eine Person.
 * Persönliche Dinge werden pro Reisende:r aufgeteilt.
 */
export function expandPersonalItems(
  items: CalculatedItem[],
  travelers: TravelerProfile[]
): CalculatedItem[] {
  if (travelers.length === 0) return items;
  const n = travelers.length;
  const out: CalculatedItem[] = [];

  for (const item of items) {
    const personal = isAlwaysPersonalItem(item.name, item.category);
    if (item.isShared && !personal) {
      out.push({ ...item, assigneeKey: item.assigneeKey || "shared" });
      continue;
    }

    const forcedPersonal = personal || !item.isShared;
    if (!forcedPersonal) {
      out.push(item);
      continue;
    }

    const assigned = travelers.find((t) => t.key === item.assigneeKey);
    const assignedFits =
      assigned && travelerFitsItem(assigned, item.name) && !isMixedGenderClothing(item.name);
    const unit = isUnitPersonalItem(item.name);
    const looksStacked =
      n > 1 &&
      unit &&
      item.quantity >= n &&
      item.quantity % n === 0;

    const genderedSplit =
      n > 1 &&
      personal &&
      (isMixedGenderClothing(item.name) ||
        (isEveningWearItem(item.name) && !assignedFits));

    const expandAll =
      n > 1 && personal && (!assignedFits || looksStacked || genderedSplit);

    if (expandAll) {
      const perQty = unit
        ? 1
        : Math.max(1, Math.round(item.quantity / n) || 1);
      for (const t of travelers) {
        const named = clothingNameForGender(item.name, t.gender);
        if (!travelerFitsItem(t, named)) continue;
        out.push(cloneForTraveler({ ...item, name: named }, t, perQty));
      }
      continue;
    }

    if (assignedFits && assigned) {
      out.push(
        cloneForTraveler(
          item,
          assigned,
          unit ? Math.min(item.quantity, 2) || 1 : Math.max(1, item.quantity)
        )
      );
      continue;
    }

    if (n === 1 && personal) {
      out.push(
        cloneForTraveler(
          item,
          travelers[0],
          unit ? Math.min(item.quantity, 2) || 1 : Math.max(1, item.quantity)
        )
      );
      continue;
    }

    out.push({
      ...item,
      isShared: false,
      assigneeKey: undefined,
      notes: stripOwnerFromNotes(item.notes) || item.notes,
    });
  }

  return fillMissingPersonalCopies(out, travelers);
}

function fillMissingPersonalCopies(
  items: CalculatedItem[],
  travelers: TravelerProfile[]
): CalculatedItem[] {
  if (travelers.length < 2) return items;
  const extra: CalculatedItem[] = [];

  const personal = items.filter(
    (i) => !i.isShared && isAlwaysPersonalItem(i.name, i.category)
  );

  const names = new Map<string, CalculatedItem[]>();
  for (const item of personal) {
    const key = normalizePackName(item.name);
    if (!key) continue;
    const list = names.get(key) || [];
    list.push(item);
    names.set(key, list);
  }

  for (const group of names.values()) {
    const template = group[0];
    if (!template) continue;
    const unit = isUnitPersonalItem(template.name);
    const holders = new Set(
      group
        .map((i) => i.assigneeKey)
        .filter((k): k is string => Boolean(k) && k !== "shared")
    );

    for (const t of travelers) {
      if (holders.has(t.key)) continue;
      const named = clothingNameForGender(template.name, t.gender);
      if (!travelerFitsItem(t, named)) continue;
      if (
        group.some(
          (g) =>
            g.assigneeKey === t.key &&
            (packNamesSimilar(g.name, named) ||
              packNamesSimilar(g.name, template.name))
        )
      ) {
        continue;
      }
      extra.push(
        cloneForTraveler(
          { ...template, name: named },
          t,
          unit ? 1 : template.quantity
        )
      );
    }
  }

  return extra.length ? [...items, ...extra] : items;
}

export function ownerNameFromNotes(notes?: string | null): string | null {
  const m = notes?.match(/für\s+([^·,/]+)/i);
  return m ? m[1].trim() : null;
}
