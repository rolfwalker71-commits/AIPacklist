"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutTemplate, Sparkles, Waypoints } from "lucide-react";
import { MultiLegWizard } from "@/components/wizard/multi-leg-wizard";
import { VibeInput } from "@/components/wizard/vibe-input";
import { TemplatePicker } from "@/components/wizard/template-picker";
import {
  SuitcasePlanner,
  defaultSuitcasePlans,
} from "@/components/wizard/suitcase-planner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GenderPicker } from "@/components/ui/gender-picker";
import { cn } from "@/lib/utils";
import { ensureLocalUser, setLocalUser } from "@/lib/local-user";
import type { PackGender, TripDraft } from "@/lib/types";
import type { SuitcasePlan } from "@/lib/suitcases";
import { TEMPLATES } from "@/lib/templates";

type Mode = "wizard" | "vibe" | "templates";

export function CreateTripClient() {
  const router = useRouter();
  const search = useSearchParams();
  const initialMode = (search.get("mode") as Mode) || "wizard";
  const [mode, setMode] = useState<Mode>(
    ["wizard", "vibe", "templates"].includes(initialMode)
      ? initialMode
      : "wizard"
  );
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("Ben");
  const [partnerName, setPartnerName] = useState("Anna");
  const [ownerGender, setOwnerGender] = useState<PackGender>("MALE");
  const [partnerGender, setPartnerGender] = useState<PackGender>("FEMALE");
  const [suitcasePlans, setSuitcasePlans] = useState<SuitcasePlan[]>(() =>
    defaultSuitcasePlans("Ben", "Anna")
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSuitcasePlans((prev) => {
      // Keep sizes/count, refresh default names for owner/partner roles lightly
      return prev.map((p) => {
        if (p.ownerRole === "owner" && /^Koffer 1/.test(p.name)) {
          return { ...p, name: `Koffer 1 (${ownerName || "Du"})` };
        }
        if (p.ownerRole === "partner" && partnerName.trim() && /^Koffer 2/.test(p.name)) {
          return { ...p, name: `Koffer 2 (${partnerName})` };
        }
        return p;
      });
    });
  }, [ownerName, partnerName]);

  useEffect(() => {
    if (!partnerName.trim()) {
      setSuitcasePlans((prev) =>
        prev
          .filter((p) => p.ownerRole !== "partner")
          .map((p) =>
            p.ownerRole === "partner" ? { ...p, ownerRole: "owner" as const } : p
          )
      );
    } else {
      setSuitcasePlans((prev) => {
        if (prev.some((p) => p.ownerRole === "partner")) return prev;
        return [
          ...prev.filter((p) => p.ownerRole !== "shared"),
          {
            id: crypto.randomUUID(),
            name: `Koffer 2 (${partnerName})`,
            size: "MEDIUM" as const,
            ownerRole: "partner" as const,
          },
          ...prev.filter((p) => p.ownerRole === "shared"),
        ];
      });
    }
  }, [partnerName]);

  const create = async (finalDraft: TripDraft) => {
    setBusy(true);
    setError(null);
    try {
      const local = ensureLocalUser();
      const owner = {
        ...local,
        name: ownerName || local.name,
        gender: ownerGender,
      };
      setLocalUser(owner);

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: finalDraft,
          owner,
          partner: partnerName
            ? {
                name: partnerName,
                color: "#B45309",
                gender: partnerGender,
              }
            : undefined,
          suitcasePlans,
        }),
      });
      if (!res.ok) throw new Error("Reise konnte nicht erstellt werden");
      const trip = await res.json();
      router.push(`/trip/${trip.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["wizard", "Etappen-Assistent", Waypoints],
            ["vibe", "KI-Freitext", Sparkles],
            ["templates", "Vorlagen", LayoutTemplate],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
              mode === id
                ? "border-teal-800 bg-teal-800 text-white"
                : "border-stone-200 bg-white/80 text-stone-700 hover:border-teal-300"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 rounded-2xl border border-stone-200 bg-white/70 p-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label>Dein Name (Besitzer:in)</Label>
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </div>
          <GenderPicker value={ownerGender} onChange={setOwnerGender} />
        </div>
        <div className="space-y-3">
          <div>
            <Label>Partner / Mitreisende:r</Label>
            <Input
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Freiwillig"
            />
          </div>
          {partnerName.trim() && (
            <GenderPicker
              value={partnerGender}
              onChange={setPartnerGender}
              label="Packprofil Partner:in"
            />
          )}
        </div>
      </div>

      <SuitcasePlanner
        plans={suitcasePlans}
        onChange={setSuitcasePlans}
        ownerName={ownerName}
        partnerName={partnerName}
      />

      {mode === "wizard" && (
        <MultiLegWizard
          initial={draft}
          busy={busy}
          onSubmit={create}
          travelers={[
            { key: "owner", name: ownerName || "Du", gender: ownerGender },
            ...(partnerName.trim()
              ? [
                  {
                    key: "partner",
                    name: partnerName,
                    gender: partnerGender,
                  },
                ]
              : []),
          ]}
        />
      )}

      {mode === "vibe" && (
        <div className="space-y-6">
          <VibeInput
            onParsed={(d) => {
              setDraft(d);
              setMode("wizard");
            }}
            travelers={[
              { key: "owner", name: ownerName || "Du", gender: ownerGender },
              ...(partnerName.trim()
                ? [
                    {
                      key: "partner",
                      name: partnerName,
                      gender: partnerGender,
                    },
                  ]
                : []),
            ]}
          />
          <p className="text-sm text-stone-500">
            Nach der Erkennung landest du im Assistenten zur Feinjustierung.
          </p>
        </div>
      )}

      {mode === "templates" && (
        <div className="space-y-6">
          <TemplatePicker
            selectedId={selectedTemplate}
            onSelect={(d) => {
              const match = TEMPLATES.find((t) => t.name === d.title);
              setSelectedTemplate(match?.id ?? null);
              setDraft(d);
            }}
          />
          {draft && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setMode("wizard")} variant="secondary">
                Im Assistenten anpassen
              </Button>
              <Button disabled={busy} onClick={() => create(draft)}>
                Direkt erstellen
              </Button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
