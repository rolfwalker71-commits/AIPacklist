"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SwipeAction = {
  id: string;
  label: string;
  onClick: () => void;
  tone?: "danger" | "neutral";
};

/** Native controls that must keep their own gesture; buttons/links stay swipeable. */
function shouldSkipSwipe(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("select, input, textarea, [data-no-swipe]"));
}

type DragMode = "none" | "h" | "v" | "skip";

/**
 * Swipe left to reveal actions (touch + mouse).
 * Uses window-level pointer listeners so a mouse drag always ends on
 * pointerup/cancel — even if the cursor left the tile — avoiding stuck
 * capture and “ghost” swipes on other cards.
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const suppressClick = useRef(false);
  const maxReveal = Math.min(72 * actions.length, 180);
  const open = offset < -4;

  const drag = useRef({
    offset: 0,
    startX: 0,
    startY: 0,
    startOffset: 0,
    mode: "none" as DragMode,
    pointerId: null as number | null,
    maxReveal,
  });
  drag.current.offset = offset;
  drag.current.maxReveal = maxReveal;

  const moveHandler = useRef<(e: PointerEvent) => void>(() => undefined);
  const upHandler = useRef<(e: PointerEvent) => void>(() => undefined);

  // Stable identities for addEventListener / removeEventListener
  const listeners = useRef({
    move(e: PointerEvent) {
      moveHandler.current(e);
    },
    up(e: PointerEvent) {
      upHandler.current(e);
    },
  }).current;

  const detach = () => {
    window.removeEventListener("pointermove", listeners.move);
    window.removeEventListener("pointerup", listeners.up);
    window.removeEventListener("pointercancel", listeners.up);
  };

  moveHandler.current = (e: PointerEvent) => {
    const d = drag.current;
    if (e.pointerId !== d.pointerId) return;
    if (d.mode === "skip" || d.mode === "v") return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.mode === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        d.mode = "v";
        d.pointerId = null;
        detach();
        return;
      }
      d.mode = "h";
      suppressClick.current = true;
      if (
        document.activeElement instanceof HTMLElement &&
        rootRef.current?.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
    }

    if (d.mode !== "h") return;
    e.preventDefault();
    setOffset(Math.min(0, Math.max(-d.maxReveal, d.startOffset + dx)));
  };

  upHandler.current = (e: PointerEvent) => {
    const d = drag.current;
    if (e.pointerId !== d.pointerId) return;
    if (d.mode === "h") {
      setOffset((o) => (o < -d.maxReveal / 2 ? -d.maxReveal : 0));
    }
    d.mode = "none";
    d.pointerId = null;
    detach();
  };

  useEffect(() => {
    return () => {
      drag.current.pointerId = null;
      drag.current.mode = "none";
      detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- detach uses stable listeners
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOffset(0);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (shouldSkipSwipe(e.target)) {
      drag.current.mode = "skip";
      return;
    }

    detach();

    suppressClick.current = false;
    const d = drag.current;
    d.mode = "none";
    d.pointerId = e.pointerId;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.startOffset = d.offset;

    window.addEventListener("pointermove", listeners.move, { passive: false });
    window.addEventListener("pointerup", listeners.up);
    window.addEventListener("pointercancel", listeners.up);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (!suppressClick.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick.current = false;
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative overflow-hidden rounded-xl", className)}
    >
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
        className="relative z-10 w-full touch-pan-y bg-transparent transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
