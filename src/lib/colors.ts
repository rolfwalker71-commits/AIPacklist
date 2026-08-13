import type { CSSProperties } from "react";

/** Shared items tint — warm sand/amber, distinct from user teals */
export const SHARED_COLOR = "#B45309";

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(15, 118, 110, ${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function tileStyle(color: string, packed?: boolean): CSSProperties {
  return {
    background: packed ? hexToRgba(color, 0.14) : hexToRgba(color, 0.07),
    borderColor: hexToRgba(color, packed ? 0.35 : 0.22),
    boxShadow: `inset 3px 0 0 ${hexToRgba(color, 0.55)}`,
  };
}
