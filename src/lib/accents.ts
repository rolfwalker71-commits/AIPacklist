import {
  Droplets,
  FileText,
  Footprints,
  Glasses,
  HeartPulse,
  PersonStanding,
  Plane,
  Shirt,
  Sparkles,
  Sun,
  Tag,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** One accent colour per area of a trip, same as in the iOS app. */
export type TripTabId = "pack" | "legs" | "bags" | "ai" | "people";

export type TabAccent = { light: string; dark: string };

export const TAB_ACCENT: Record<TripTabId, TabAccent> = {
  pack: { light: "#0f766e", dark: "#5eead4" },
  legs: { light: "#0369a1", dark: "#7dd3fc" },
  bags: { light: "#c2410c", dark: "#fdba74" },
  ai: { light: "#6d28d9", dark: "#c4b5fd" },
  people: { light: "#be185d", dark: "#f9a8d4" },
};

/** CSS custom properties consumed by the dock / sidebar active state. */
export function accentVars(accent: TabAccent): Record<string, string> {
  return { "--accent-c": accent.light, "--accent-c-dark": accent.dark };
}

const CATEGORY_STYLE: Record<string, { icon: LucideIcon; color: string }> = {
  dokumente: { icon: FileText, color: "#4f46e5" },
  kleidung: { icon: Shirt, color: "#0f766e" },
  schuhe: { icon: Footprints, color: "#f97316" },
  pflege: { icon: Droplets, color: "#0ea5e9" },
  gesundheit: { icon: HeartPulse, color: "#e11d48" },
  technik: { icon: Zap, color: "#7c3aed" },
  accessoires: { icon: Glasses, color: "#ec4899" },
  aktivität: { icon: PersonStanding, color: "#65a30d" },
  freizeit: { icon: Sun, color: "#f59e0b" },
  festlich: { icon: Sparkles, color: "#ec4899" },
  reise: { icon: Plane, color: "#0ea5e9" },
};

export function categoryStyle(category: string): {
  icon: LucideIcon;
  color: string;
} {
  return (
    CATEGORY_STYLE[category.trim().toLowerCase()] ?? {
      icon: Tag,
      color: "#78716c",
    }
  );
}

const ROW_COLORS = ["#0f766e", "#0ea5e9", "#7c3aed", "#ec4899", "#f97316"];

/** Stable colour for a trip row (same id → same colour). */
export function rowColor(id: string): string {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return ROW_COLORS[sum % ROW_COLORS.length];
}
