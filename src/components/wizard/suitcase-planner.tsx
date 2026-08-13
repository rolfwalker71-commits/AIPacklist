"use client";

import { Plus, Trash2, Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  SUITCASE_SIZES,
  type SuitcaseOwnerRole,
  type SuitcasePlan,
  type SuitcaseSize,
} from "@/lib/suitcases";

function uid() {
  return crypto.randomUUID();
}

export function defaultSuitcasePlans(
  ownerName: string,
  partnerName?: string
): SuitcasePlan[] {
  const plans: SuitcasePlan[] = [
    {
      id: uid(),
      name: `Koffer 1 (${ownerName || "Du"})`,
      size: "MEDIUM",
      ownerRole: "owner",
    },
  ];
  if (partnerName?.trim()) {
    plans.push({
      id: uid(),
      name: `Koffer 2 (${partnerName})`,
      size: "MEDIUM",
      ownerRole: "partner",
    });
  }
  plans.push({
    id: uid(),
    name: "Handgepäck / Shared",
    size: "CABIN",
    ownerRole: "shared",
  });
  return plans;
}

interface Props {
  plans: SuitcasePlan[];
  onChange: (plans: SuitcasePlan[]) => void;
  ownerName: string;
  partnerName?: string;
}

export function SuitcasePlanner({
  plans,
  onChange,
  ownerName,
  partnerName,
}: Props) {
  const update = (id: string, patch: Partial<SuitcasePlan>) => {
    onChange(plans.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const remove = (id: string) => {
    if (plans.length <= 1) return;
    onChange(plans.filter((p) => p.id !== id));
  };

  const add = () => {
    const n = plans.filter((p) => p.ownerRole !== "shared").length + 1;
    onChange([
      ...plans,
      {
        id: uid(),
        name: `Koffer ${n}`,
        size: "MEDIUM",
        ownerRole: partnerName?.trim() ? "partner" : "owner",
      },
    ]);
  };

  const ownerOptions: { id: SuitcaseOwnerRole; label: string }[] = [
    { id: "owner", label: ownerName || "Besitzer" },
    ...(partnerName?.trim()
      ? [{ id: "partner" as const, label: partnerName }]
      : []),
    { id: "shared", label: "Shared / gemeinsam" },
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-stone-900">Koffer</h3>
          <p className="text-sm text-stone-500">
            Anzahl und Größe festlegen — hilft bei Cross-Packing und
            Gepäckverlust.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          <Plus className="h-4 w-4" /> Koffer
        </Button>
      </div>

      <div className="space-y-3">
        {plans.map((plan, idx) => (
          <div
            key={plan.id}
            className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <div>
              <Label>Name</Label>
              <div className="relative">
                <Luggage className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-800" />
                <Input
                  className="pl-9"
                  value={plan.name}
                  onChange={(e) => update(plan.id, { name: e.target.value })}
                  placeholder={`Koffer ${idx + 1}`}
                />
              </div>
            </div>
            <div>
              <Label>Größe</Label>
              <div className="flex flex-wrap gap-1.5">
                {SUITCASE_SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.hint}
                    onClick={() => update(plan.id, { size: s.id as SuitcaseSize })}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-xs font-semibold",
                      plan.size === s.id
                        ? "border-teal-800 bg-teal-800 text-white"
                        : "border-stone-200 bg-white text-stone-700"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Zuordnung</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-stone-300 bg-white/80 px-3 text-sm"
                value={plan.ownerRole}
                onChange={(e) =>
                  update(plan.id, {
                    ownerRole: e.target.value as SuitcaseOwnerRole,
                  })
                }
              >
                {ownerOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={plans.length <= 1}
                onClick={() => remove(plan.id)}
                aria-label="Koffer entfernen"
              >
                <Trash2 className="h-4 w-4 text-rose-600" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-500">
        {plans.length} Koffer · Größen:{" "}
        {SUITCASE_SIZES.map((s) => `${s.label}=${s.hint}`).join(" · ")}
      </p>
    </div>
  );
}
