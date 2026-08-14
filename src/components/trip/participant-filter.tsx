"use client";

import { cn } from "@/lib/utils";
import { SHARED_COLOR } from "@/lib/colors";

export type ParticipantFilterOption = {
  key: string;
  label: string;
  color: string;
};

/**
 * Multi-select chips: members + shared. Empty selection = show all.
 */
export function ParticipantFilter({
  options,
  selected,
  onChange,
}: {
  options: ParticipantFilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const allOn = selected.length === 0 || selected.length === options.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            "rounded-full border px-3.5 py-2 text-sm font-semibold transition",
            allOn
              ? "border-teal-800 bg-teal-800 text-white"
              : "border-stone-200 bg-white text-stone-600"
          )}
        >
          Alle
        </button>
        {options.map((opt) => {
          const on = selected.includes(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
                on
                  ? "border-stone-800/20 text-stone-900 shadow-sm"
                  : "border-stone-200 bg-white text-stone-500"
              )}
              style={
                on
                  ? {
                      background: `${opt.color}22`,
                      borderColor: `${opt.color}55`,
                    }
                  : undefined
              }
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: opt.color }}
              />
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-stone-500">
        Mehrfachwahl möglich. «Alle» setzt den Filter zurück.
      </p>
    </div>
  );
}

export function sharedFilterOption(): ParticipantFilterOption {
  return { key: "shared", label: "Gemeinsam", color: SHARED_COLOR };
}
