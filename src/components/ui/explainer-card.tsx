"use client";

import { X } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { Illustration, type IllustrationKind } from "@/components/ui/illustration";
import { cn } from "@/lib/utils";

export const EXPLAINER_KEY = "fp-dismissed-explainers";
export const HINTS_EVENT = "fp-hints-changed";

const TINT: Record<IllustrationKind, string> = {
  pack: "tint-teal",
  wizard: "tint-teal",
  route: "tint-sky",
  join: "tint-sky",
  weather: "tint-sky",
  bags: "tint-orange",
  bell: "tint-orange",
  tips: "tint-violet",
  team: "tint-pink",
  dupes: "tint-violet",
};

function parseDismissed(raw: string): string[] {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(HINTS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(HINTS_EVENT, callback);
  };
}

function snapshot(): string {
  try {
    return localStorage.getItem(EXPLAINER_KEY) || "[]";
  } catch {
    return "[]";
  }
}

/** On the server nothing is known yet, so cards stay hidden until the browser answers. */
const serverSnapshot = (): string | null => null;

/** Help card with an illustration. Shown once per topic, dismissed for good. */
export function ExplainerCard({
  id,
  kind,
  title,
  children,
  className,
}: {
  id: string;
  kind: IllustrationKind;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (raw === null || parseDismissed(raw).includes(id)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(
        EXPLAINER_KEY,
        JSON.stringify([...new Set([...parseDismissed(raw), id])])
      );
    } catch {
      /* private mode: the card comes back on the next visit */
    }
    window.dispatchEvent(new Event(HINTS_EVENT));
  };

  return (
    <aside
      className={cn(
        "glass animate-rise relative flex items-center gap-3.5 rounded-[var(--r-lg)] p-3.5 pr-10",
        TINT[kind],
        className
      )}
    >
      <Illustration kind={kind} size={68} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-[0.82rem] leading-snug text-muted-foreground">
          {children}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hinweis schliessen"
        className="absolute right-2.5 top-2.5 rounded-full p-1 text-subtle transition hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}

/** Show every hint (and the onboarding) again. */
export function resetHints() {
  try {
    localStorage.removeItem(EXPLAINER_KEY);
    localStorage.removeItem("fp-onboarding-done");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(HINTS_EVENT));
}
