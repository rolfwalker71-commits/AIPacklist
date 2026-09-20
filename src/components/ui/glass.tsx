import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Material = "ultrathin" | "thin" | "regular" | "thick";
type Tint = "none" | "amber" | "teal" | "rose";
type Elevation = "flat" | "raised" | "float";
type Radius = "sm" | "md" | "lg" | "xl" | "full";

const MATERIAL: Record<Material, string> = {
  ultrathin: "glass-ultrathin",
  thin: "glass-thin",
  regular: "",
  thick: "glass-thick",
};

const TINT: Record<Tint, string> = {
  none: "",
  amber: "tint-amber",
  teal: "tint-teal",
  rose: "tint-rose",
};

const ELEVATION: Record<Elevation, string> = {
  flat: "",
  raised: "glass-raised",
  float: "glass-float",
};

const RADIUS: Record<Radius, string> = {
  sm: "rounded-[var(--r-sm)]",
  md: "rounded-[var(--r-md)]",
  lg: "rounded-[var(--r-lg)]",
  xl: "rounded-[var(--r-xl)]",
  full: "rounded-full",
};

export type GlassProps = {
  material?: Material;
  tint?: Tint;
  elevation?: Elevation;
  radius?: Radius;
  selected?: boolean;
  dashed?: boolean;
};

export function glassClass({
  material = "regular",
  tint = "none",
  elevation = "flat",
  radius = "lg",
  selected,
  dashed,
}: GlassProps = {}) {
  return cn(
    "glass",
    MATERIAL[material],
    TINT[tint],
    ELEVATION[elevation],
    RADIUS[radius],
    selected && "glass-selected",
    dashed && "glass-dashed"
  );
}

/** A pane of Liquid Glass — the one surface every card in the app sits on. */
export function Glass({
  className,
  material,
  tint,
  elevation,
  radius,
  selected,
  dashed,
  ...props
}: HTMLAttributes<HTMLDivElement> & GlassProps) {
  return (
    <div
      className={cn(
        glassClass({ material, tint, elevation, radius, selected, dashed }),
        className
      )}
      {...props}
    />
  );
}

/**
 * A floating glass bar — content scrolls beneath it rather than being
 * pushed by it. Used for the tab bar, the trip toolbar and the top bar.
 */
export function GlassBar({
  className,
  children,
  material = "thick",
  ...props
}: HTMLAttributes<HTMLDivElement> & { material?: Material }) {
  return (
    <div
      className={cn(
        glassClass({ material, elevation: "float", radius: "xl" }),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Section eyebrow + title, used above every list group. */
export function SectionHeader({
  title,
  hint,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-section-title text-foreground">
          {title}
        </h3>
        {hint && (
          <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Progress bar. `color` overrides the default teal gradient. */
export function Track({
  pct,
  color,
  slim,
  className,
}: {
  pct: number;
  color?: string;
  slim?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("track", slim && "track-slim", className)}>
      <span
        style={{
          width: `${clamped}%`,
          ...(color ? { background: color, boxShadow: "none" } : null),
        }}
      />
    </div>
  );
}
