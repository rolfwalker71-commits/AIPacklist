"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SwipeAction = {
  id: string;
  label: string;
  onClick: () => void;
  tone?: "danger" | "neutral";
};

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, select, textarea, label, [role='button'], [data-no-swipe]"
    )
  );
}

/**
 * Swipe left to reveal actions. Works with touch and mouse drag.
 * Clicks on buttons/selects are never captured so packing toggles keep working.
 */
export function SwipeRow({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions: SwipeAction[];
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const mode = useRef<"none" | "h" | "v" | "skip">("none");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const maxReveal = Math.min(72 * actions.length, 180);
  const open = offset < -4;

  const endDrag = (e?: React.PointerEvent) => {
    if (mode.current === "h") {
      setOffset((o) => (o < -maxReveal / 2 ? -maxReveal : 0));
    }
    if (
      e &&
      panelRef.current?.hasPointerCapture(e.pointerId)
    ) {
      panelRef.current.releasePointerCapture(e.pointerId);
    }
    mode.current = "none";
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (isInteractiveTarget(e.target)) {
      mode.current = "skip";
      return;
    }
    mode.current = "none";
    startX.current = e.clientX;
    startY.current = e.clientY;
    startOffset.current = offset;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode.current === "skip") return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (mode.current === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        mode.current = "h";
        panelRef.current?.setPointerCapture(e.pointerId);
      } else {
        mode.current = "v";
        return;
      }
    }
    if (mode.current !== "h") return;
    e.preventDefault();
    const next = Math.min(0, Math.max(-maxReveal, startOffset.current + dx));
    setOffset(next);
  };

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex transition-opacity duration-150",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!open}
      >
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOffset(0);
              a.onClick();
            }}
            className={cn(
              "flex h-full min-w-[72px] items-center justify-center px-3 text-xs font-semibold text-white",
              a.tone === "danger" ? "bg-rose-600" : "bg-stone-700"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        ref={panelRef}
        className="relative z-10 w-full touch-pan-y bg-transparent transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {children}
      </div>
    </div>
  );
}
