"use client";

import { TEMPLATES } from "@/lib/templates";
import type { TripDraft } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  onSelect: (draft: TripDraft) => void;
  selectedId?: string | null;
}

export function TemplatePicker({ onSelect, selectedId }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {TEMPLATES.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          onClick={() => onSelect(tpl.build())}
          className={cn(
            "group rounded-2xl border p-5 text-left transition",
            selectedId === tpl.id
              ? "border-teal-700 bg-teal-50 shadow-md"
              : "border-stone-200 bg-white/80 hover:border-teal-300 hover:shadow-sm"
          )}
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
            {tpl.tagline}
          </div>
          <h3 className="font-display text-lg text-stone-900 group-hover:text-teal-900">
            {tpl.name}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            {tpl.description}
          </p>
        </button>
      ))}
    </div>
  );
}
