"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SwipeAction = {
  id: string;
  label: string;
  onClick: () => void;
  tone?: "danger" | "neutral";
};

/**
 * Swipe left to reveal actions. Works with touch and mouse drag.
 * Vertical scrolling stays intact; horizontal drag past a small threshold opens.
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
  const mode = useRef<"none" | "h" | "v">("none");
  const maxReveal = Math.min(72 * actions.length, 180);

  const endDrag = () => {
    if (mode.current === "h") {
      setOffset((o) => (o < -maxReveal / 2 ? -maxReveal : 0));
    }
    mode.current = "none";
  };

  const onPointerDown = (e: React.PointerEvent) => {
    mode.current = "none";
    startX.current = e.clientX;
    startY.current = e.clientY;
    startOffset.current = offset;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (mode.current === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      mode.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (mode.current !== "h") return;
    e.preventDefault();
    const next = Math.min(0, Math.max(-maxReveal, startOffset.current + dx));
    setOffset(next);
  };

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
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
        className="relative touch-pan-y transition-transform duration-150 ease-out"
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
