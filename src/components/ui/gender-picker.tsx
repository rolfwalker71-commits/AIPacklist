"use client";

import { cn } from "@/lib/utils";
import type { PackGender } from "@/lib/types";
import { Label } from "@/components/ui/label";

const OPTIONS: { id: PackGender; label: string }[] = [
  { id: "FEMALE", label: "Weiblich" },
  { id: "MALE", label: "Männlich" },
  { id: "UNSPECIFIED", label: "Egal / divers" },
];

export function GenderPicker({
  value,
  onChange,
  label = "Packprofil",
}: {
  value: PackGender;
  onChange: (g: PackGender) => void;
  label?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="mb-2 text-xs text-stone-500">
        Beeinflusst persönliche Kleidung & Formalwear — optional.
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-medium transition",
              value === opt.id
                ? "border-teal-800 bg-teal-800 text-white"
                : "border-stone-200 bg-white text-stone-700 hover:border-teal-300"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
