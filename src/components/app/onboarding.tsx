"use client";

import { useState, useSyncExternalStore } from "react";
import { HINTS_EVENT } from "@/components/ui/explainer-card";
import { Illustration, type IllustrationKind } from "@/components/ui/illustration";

export const ONBOARDING_KEY = "fp-onboarding-done";

const PAGES: {
  kind: IllustrationKind;
  title: string;
  text: string;
  colors: [string, string];
}[] = [
  {
    kind: "route",
    title: "Reisen mit mehreren Etappen",
    text: "Kreuzfahrt, Flug und Roadtrip in einer Reise. Pro Etappe zählen Wetter, Wäsche und Dresscode.",
    colors: ["#0ea5e9", "#4f46e5"],
  },
  {
    kind: "pack",
    title: "Jede:r packt für sich",
    text: "Alle haben ihre eigene Liste. Gemeinsame Dinge wie Duschgel erscheinen nur einmal.",
    colors: ["#0f766e", "#34d399"],
  },
  {
    kind: "team",
    title: "Live gemeinsam",
    text: "Was jemand abhakt, sehen alle sofort. Mit dem Einladungscode kommt jede Person dazu, auch per Browser.",
    colors: ["#ec4899", "#7c3aed"],
  },
  {
    kind: "bags",
    title: "Koffer im Blick",
    text: "Verteile Items auf Koffer und sieh früh, wenn einer zu voll wird.",
    colors: ["#f97316", "#fbbf24"],
  },
  {
    kind: "tips",
    title: "Schlau unterstützt",
    text: "Die KI ergänzt fehlende Dinge. Dazu kommen Wetter und Tipps für deine Route.",
    colors: ["#7c3aed", "#2563eb"],
  },
];

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
    return localStorage.getItem(ONBOARDING_KEY) || "";
  } catch {
    return "1"; // storage blocked: do not nag on every visit
  }
}

/** Full-screen introduction shown once after the first sign-in. */
export function Onboarding() {
  const done = useSyncExternalStore(subscribe, snapshot, (): string | null => null);
  const [page, setPage] = useState(0);

  if (done === null || done === "1") return null;

  const finish = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(HINTS_EVENT));
  };

  const current = PAGES[page];
  const last = page === PAGES.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Willkommen bei FlexiPack"
      className="fixed inset-0 z-[100] flex flex-col text-white transition-[background] duration-700"
      style={{
        background: `linear-gradient(150deg, ${current.colors[0]}, ${current.colors[1]})`,
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-white/10 transition-all duration-700" style={{ transform: `translateX(${page * 40}px)` }} />
        <span className="absolute -right-24 bottom-24 h-80 w-80 rounded-full bg-white/10 transition-all duration-700" style={{ transform: `translateX(${page * -30}px)` }} />
        <span className="absolute left-6 top-24 h-20 w-20 rounded-full bg-yellow-300/25 transition-all duration-700" style={{ transform: `translateX(${page * 50}px)` }} />
      </div>

      <div className="relative mx-auto flex w-full max-w-md items-center justify-end px-6 pt-[max(1rem,env(safe-area-inset-top))]">
        {!last && (
          <button type="button" onClick={finish} className="text-sm font-semibold text-white/90">
            Überspringen
          </button>
        )}
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
        <div
          key={page}
          className="animate-rise relative flex h-[300px] w-[300px] items-center justify-center"
        >
          <span className="absolute inset-0 rounded-full bg-white/15" />
          <span className="absolute -inset-5 rounded-full border-2 border-white/25" />
          <Illustration kind={current.kind} size={220} plain tint={current.colors[0]} />
        </div>
        <div key={`t-${page}`} className="animate-rise space-y-2.5">
          <h2 className="font-display text-[2rem] font-bold leading-tight">{current.title}</h2>
          <p className="text-base text-white/90">{current.text}</p>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-md px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-5 flex justify-center gap-2" aria-hidden>
          {PAGES.map((_, i) => (
            <span
              key={i}
              className="h-2 rounded-full bg-white transition-all duration-300"
              style={{ width: i === page ? 26 : 8, opacity: i === page ? 1 : 0.4 }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? finish() : setPage(page + 1))}
          className="min-h-12 w-full rounded-full bg-white text-base font-bold shadow-lg transition active:scale-[0.98]"
          style={{ color: current.colors[0] }}
        >
          {last ? "Los geht's" : "Weiter"}
        </button>
      </div>
    </div>
  );
}
