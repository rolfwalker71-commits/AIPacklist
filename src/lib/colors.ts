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

/**
 * Owner tint for a pack row. The row itself is glass (see `.glass`), so we
 * only add the owner's colour as a wash plus a bright edge stripe — the
 * material underneath keeps doing the blurring.
 */
export function tileStyle(color: string, packed?: boolean): CSSProperties {
  const tint = hexToRgba(color, packed ? 0.16 : 0.09);
  return {
    backgroundImage: `linear-gradient(140deg, ${tint}, transparent 62%)`,
    boxShadow: `inset 3px 0 0 ${hexToRgba(color, 0.62)}, inset 0 1px 0 var(--rim-top), inset 0 0 0 1px var(--edge), var(--lift-1)`,
  };
}
