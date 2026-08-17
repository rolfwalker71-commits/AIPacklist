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
  if (FEMALE_ONLY.some((k) => n.includes(hay(k)))) return "FEMALE";
  if (MALE_ONLY.some((k) => n.includes(hay(k)))) return "MALE";
  return null;
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

function notesFor(traveler: TravelerProfile, extra?: string | null): string {
  const rest = (extra || "")
    .replace(/für\s+[^·]+/gi, "")
    .replace(/^[\s·,/-]+/, "")
    .trim();
  return rest ? `für ${traveler.name} · ${rest}` : `für ${traveler.name}`;
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
    const unit = isUnitPersonalItem(item.name);
    const looksStacked =
      n > 1 &&
      unit &&
      item.quantity >= n &&
      item.quantity % n === 0;

    const expandAll =
      n > 1 && personal && (!assigned || looksStacked);

    if (expandAll) {
      const perQty = unit
        ? 1
        : Math.max(1, Math.round(item.quantity / n) || 1);
      for (const t of travelers) {
        if (!travelerFitsItem(t, item.name)) continue;
        out.push(cloneForTraveler(item, t, perQty));
      }
      continue;
    }

    const target = assigned || travelers[0];
    out.push(
      cloneForTraveler(
        item,
        target,
        unit ? Math.min(item.quantity, 2) || 1 : Math.max(1, item.quantity)
      )
    );
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
      if (!travelerFitsItem(t, template.name)) continue;
      if (
        group.some(
          (g) =>
            g.assigneeKey === t.key &&
            packNamesSimilar(g.name, template.name)
        )
      ) {
        continue;
      }
      extra.push(
        cloneForTraveler(template, t, unit ? 1 : template.quantity)
      );
    }
  }

  return extra.length ? [...items, ...extra] : items;
}

export function ownerNameFromNotes(notes?: string | null): string | null {
  const m = notes?.match(/für\s+([^·,/]+)/i);
  return m ? m[1].trim() : null;
}
