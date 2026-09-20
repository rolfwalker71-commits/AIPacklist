"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A glass capsule holding mutually exclusive options; the selected one
 * gets a bright gel thumb. Wraps on narrow screens rather than scrolling.
 */
export function Segmented({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "glass glass-thin scroll-x flex max-w-full items-stretch gap-0.5 rounded-full p-1 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Segment({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5",
        "text-sm font-semibold leading-none transition",
        active
          ? "bg-[rgba(255,255,255,0.92)] text-[var(--teal-800)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_3px_rgba(11,61,57,0.14)] dark:bg-[rgba(255,255,255,0.16)] dark:text-[#eafffb]"
          : "bg-transparent text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * A single toggleable filter pill. Pressed pills carry the primary tint
 * so an active filter set is readable at a glance.
 */
export function Chip({
  pressed,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold leading-none transition active:scale-[0.97]",
        pressed
          ? "text-white bg-[linear-gradient(160deg,var(--teal-600),var(--teal-800))] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_3px_10px_rgba(15,118,110,0.30)]"
          : "glass glass-thin text-muted-foreground backdrop-blur-xl",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
