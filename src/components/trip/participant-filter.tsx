"use client";

import { Chip } from "@/components/ui/segmented";
import { SHARED_COLOR } from "@/lib/colors";

export type ParticipantFilterOption = {
  key: string;
  label: string;
  color: string;
};

/**
 * Multi-select chips: members + shared. Empty selection = show all.
 * A pressed chip carries the person's own colour so the active filter
 * matches the tint on their rows.
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
    <div className="flex flex-wrap items-center gap-2">
      <Chip pressed={allOn} onClick={() => onChange([])}>
        Alle
      </Chip>
      {options.map((opt) => {
        const on = selected.includes(opt.key);
        return (
          <Chip
            key={opt.key}
            pressed={on}
            onClick={() => toggle(opt.key)}
            style={
              on
                ? {
                    background: `linear-gradient(160deg, ${opt.color}, ${opt.color}cc)`,
                  }
                : undefined
            }
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: on ? "rgba(255,255,255,0.9)" : opt.color }}
              aria-hidden
            />
            {opt.label}
          </Chip>
        );
      })}
    </div>
  );
}

export function sharedFilterOption(): ParticipantFilterOption {
  return { key: "shared", label: "Gemeinsam", color: SHARED_COLOR };
}

export function unassignedFilterOption(): ParticipantFilterOption {
  return { key: "personal", label: "Ohne Zuweisung", color: "#78716c" };
}
