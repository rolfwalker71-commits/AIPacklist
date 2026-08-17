"use client";

import { Button } from "@/components/ui/button";
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
        <Button
          type="button"
          size="sm"
          variant={allOn ? "default" : "outline"}
          onClick={() => onChange([])}
          aria-pressed={allOn}
        >
          Alle
        </Button>
        {options.map((opt) => {
          const on = selected.includes(opt.key);
          return (
            <Button
              key={opt.key}
              type="button"
              size="sm"
              variant={on ? "secondary" : "outline"}
              onClick={() => toggle(opt.key)}
              aria-pressed={on}
              className={cn("gap-1.5")}
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
                aria-hidden
              />
              {opt.label}
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        Tippe auf eine Person, um nur ihre Packliste zu sehen.
      </p>
    </div>
  );
}

export function sharedFilterOption(): ParticipantFilterOption {
  return { key: "shared", label: "Gemeinsam", color: SHARED_COLOR };
}
