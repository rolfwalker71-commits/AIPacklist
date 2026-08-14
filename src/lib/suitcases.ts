export type SuitcaseSize = "CABIN" | "MEDIUM" | "LARGE" | "XL";

export const SUITCASE_SIZES: {
  id: SuitcaseSize;
  label: string;
  hint: string;
  /** Soft max pack positions for AI load balancing (not physical law). */
  softMaxItems: number;
}[] = [
  {
    id: "CABIN",
    label: "Handgepäck",
    hint: "Kabinenmass / ca. 8–10 kg · ~22 Positionen",
    softMaxItems: 22,
  },
  {
    id: "MEDIUM",
    label: "Mittel",
    hint: "Aufgabegepäck ca. 55–70 cm / 20–23 kg · ~40 Positionen",
    softMaxItems: 40,
  },
  {
    id: "LARGE",
    label: "Gross",
    hint: "Grosses Aufgabegepäck / ca. 23–28 kg · ~55 Positionen",
    softMaxItems: 55,
  },
  {
    id: "XL",
    label: "Sehr gross",
    hint: "Übergrösse / Sperrgepäck · ~75 Positionen",
    softMaxItems: 75,
  },
];

export function suitcaseSizeLabel(size: SuitcaseSize | string): string {
  return SUITCASE_SIZES.find((s) => s.id === size)?.label || size;
}

export type SuitcaseOwnerRole = "owner" | "partner" | "shared";

export interface SuitcasePlan {
  id: string;
  name: string;
  size: SuitcaseSize;
  ownerRole: SuitcaseOwnerRole;
}
