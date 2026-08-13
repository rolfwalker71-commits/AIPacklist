export type SuitcaseSize = "CABIN" | "MEDIUM" | "LARGE" | "XL";

export const SUITCASE_SIZES: {
  id: SuitcaseSize;
  label: string;
  hint: string;
}[] = [
  { id: "CABIN", label: "Handgepäck", hint: "Kabinenmass / ca. 8–10 kg" },
  { id: "MEDIUM", label: "Mittel", hint: "Aufgabegepäck ca. 55–70 cm / 20–23 kg" },
  { id: "LARGE", label: "Gross", hint: "Grosses Aufgabegepäck / ca. 23–28 kg" },
  { id: "XL", label: "Sehr gross", hint: "Übergrösse / Sperrgepäck" },
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
