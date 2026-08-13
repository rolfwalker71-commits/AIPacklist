export type SuitcaseSize = "CABIN" | "MEDIUM" | "LARGE" | "XL";

export const SUITCASE_SIZES: {
  id: SuitcaseSize;
  label: string;
  hint: string;
}[] = [
  { id: "CABIN", label: "Handgepäck", hint: "Kabinenmaß / ~8–10 kg" },
  { id: "MEDIUM", label: "Mittel", hint: "Check-in ~55–70 cm / ~20–23 kg" },
  { id: "LARGE", label: "Groß", hint: "Großer Check-in / ~23–28 kg" },
  { id: "XL", label: "XL", hint: "Übergröße / Sperrgepäck" },
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
