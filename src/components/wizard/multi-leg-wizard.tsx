"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Ship, Plane, Car, Train, Trash2, Waves } from "lucide-react";
import { addDays, differenceInCalendarDays, formatISO, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import type { DressCode, LegInput, Transport, TravelerProfile, TripDraft, WeatherTag } from "@/lib/types";
import { calculatePackList, summarizeLaundry } from "@/lib/calculator";
import { LOCATION_PRESETS } from "@/lib/locations";
import { cn } from "@/lib/utils";

const TRANSPORTS: { id: Transport; label: string; icon: typeof Ship }[] = [
  { id: "SHIP", label: "Schiff", icon: Ship },
  { id: "FLIGHT", label: "Flug", icon: Plane },
  { id: "CAR", label: "Auto", icon: Car },
  { id: "TRAIN", label: "Zug", icon: Train },
];

const WEATHER: { id: WeatherTag; label: string }[] = [
  { id: "cool_windy", label: "Kühl/Windig" },
  { id: "tropical", label: "Tropisch" },
  { id: "uncertain", label: "Ungewiss" },
  { id: "hot", label: "Heiss" },
  { id: "cold", label: "Kalt" },
  { id: "rainy", label: "Regnerisch" },
];

const DRESS: { id: DressCode; label: string }[] = [
  { id: "gala", label: "Festlich / Gala" },
  { id: "casual", label: "Lässig" },
  { id: "sport", label: "Sport" },
  { id: "smart_casual", label: "Smart lässig" },
];

function emptyLeg(start: string, end: string): LegInput {
  return {
    name: "Etappe",
    location: "",
    startDate: start,
    endDate: end,
    transport: "SHIP",
    laundryAvailable: false,
    laundryIntervalDays: null,
    weatherTags: ["uncertain"],
    dressCodes: ["casual"],
  };
}

function todayISO() {
  return formatISO(new Date(), { representation: "date" });
}

interface Props {
  onSubmit: (draft: TripDraft) => void;
  initial?: TripDraft | null;
  busy?: boolean;
  travelers?: TravelerProfile[];
}

export function MultiLegWizard({ onSubmit, initial, busy, travelers }: Props) {
  const [title, setTitle] = useState(initial?.title || "Meine Reise");
  const [rangeStart, setRangeStart] = useState(
    initial?.startDate || todayISO()
  );
  const [rangeEnd, setRangeEnd] = useState(
    initial?.endDate ||
      formatISO(addDays(new Date(), 13), { representation: "date" })
  );
  const [legs, setLegs] = useState<LegInput[]>(
    initial?.legs?.length
      ? initial.legs
      : [
          emptyLeg(
            todayISO(),
            formatISO(addDays(new Date(), 13), { representation: "date" })
          ),
        ]
  );

  useEffect(() => {
    if (!initial) return;
    setTitle(initial.title);
    setRangeStart(initial.startDate);
    setRangeEnd(initial.endDate);
    setLegs(initial.legs);
  }, [initial]);

  const totalDays = useMemo(() => {
    return (
      differenceInCalendarDays(parseISO(rangeEnd), parseISO(rangeStart)) + 1
    );
  }, [rangeStart, rangeEnd]);

  const summary = useMemo(() => summarizeLaundry(legs), [legs]);
  const preview = useMemo(
    () => calculatePackList(legs, travelers),
    [legs, travelers]
  );

  const updateLeg = (idx: number, patch: Partial<LegInput>) => {
    setLegs((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const toggleTag = <T extends string>(
    idx: number,
    key: "weatherTags" | "dressCodes",
    value: T
  ) => {
    setLegs((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const arr = l[key] as string[];
        const next = arr.includes(value)
          ? arr.filter((x) => x !== value)
          : [...arr, value];
        return { ...l, [key]: next };
      })
    );
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Label>Reisetitel</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Reisebeginn</Label>
          <DatePicker value={rangeStart} onChange={setRangeStart} max={rangeEnd} />
        </div>
        <div>
          <Label>Reiseende</Label>
          <DatePicker value={rangeEnd} onChange={setRangeEnd} min={rangeStart} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-teal-200/60 bg-teal-50/70 px-4 py-3 text-sm text-teal-950">
        <Waves className="h-4 w-4" />
        <span>
          Gesamtreise: <strong>{totalDays} Tage</strong>
        </span>
        <span className="text-teal-700/50">·</span>
        <span>
          Max. ohne Wäsche: <strong>{summary.daysWithoutLaundry} Tage</strong>
        </span>
        {summary.atlanticAutumn && (
          <>
            <span className="text-teal-700/50">·</span>
            <span>Atlantik-/Herbst-Logik aktiv</span>
          </>
        )}
        {summary.galaEvents > 0 && (
          <>
            <span className="text-teal-700/50">·</span>
            <span>{summary.galaEvents} Fest-/Gala-Abend(e)</span>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-stone-900">Etappen</h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setLegs((prev) => [
                ...prev,
                emptyLeg(rangeStart, rangeEnd),
              ])
            }
          >
            <Plus className="h-4 w-4" /> Etappe
          </Button>
        </div>

        {legs.map((leg, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-stone-200 bg-white/70 p-4 shadow-sm backdrop-blur"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <Label>Name</Label>
                <Input
                  value={leg.name}
                  onChange={(e) => updateLeg(idx, { name: e.target.value })}
                />
              </div>
              {legs.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setLegs((p) => p.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              )}
            </div>

            <div className="mb-4">
              <Label>Ungefährer Ort / Region</Label>
              <Input
                value={leg.location || ""}
                onChange={(e) => updateLeg(idx, { location: e.target.value })}
                placeholder="z.B. Florida, Karibik, Transatlantik"
                list={`leg-locations-${idx}`}
              />
              <datalist id={`leg-locations-${idx}`}>
                {LOCATION_PRESETS.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LOCATION_PRESETS.slice(0, 6).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => updateLeg(idx, { location: loc })}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs",
                      leg.location === loc
                        ? "border-teal-700 bg-teal-800 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-teal-300"
                    )}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Start</Label>
                <DatePicker
                  value={leg.startDate}
                  onChange={(v) => updateLeg(idx, { startDate: v })}
                  max={leg.endDate}
                />
              </div>
              <div>
                <Label>Ende</Label>
                <DatePicker
                  value={leg.endDate}
                  onChange={(v) => updateLeg(idx, { endDate: v })}
                  min={leg.startDate}
                />
              </div>
            </div>

            <div className="mt-4">
              <Label>Transport</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {TRANSPORTS.map((t) => {
                  const Icon = t.icon;
                  const active = leg.transport === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => updateLeg(idx, { transport: t.id })}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                        active
                          ? "border-teal-700 bg-teal-800 text-white"
                          : "border-stone-200 bg-white text-stone-700 hover:border-teal-300"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <Label>Waschmöglichkeit</Label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      !leg.laundryAvailable
                        ? "border-teal-700 bg-teal-800 text-white"
                        : "border-stone-200 bg-white"
                    )}
                    onClick={() =>
                      updateLeg(idx, {
                        laundryAvailable: false,
                        laundryIntervalDays: null,
                      })
                    }
                  >
                    Nein
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      leg.laundryAvailable
                        ? "border-teal-700 bg-teal-800 text-white"
                        : "border-stone-200 bg-white"
                    )}
                    onClick={() =>
                      updateLeg(idx, {
                        laundryAvailable: true,
                        laundryIntervalDays: leg.laundryIntervalDays || 3,
                      })
                    }
                  >
                    Ja
                  </button>
                </div>
              </div>
              {leg.laundryAvailable && (
                <div>
                  <Label>Wasch-Intervall (Tage)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={leg.laundryIntervalDays ?? 3}
                    onChange={(e) =>
                      updateLeg(idx, {
                        laundryIntervalDays: Number(e.target.value),
                      })
                    }
                  />
                </div>
              )}
            </div>

            <div className="mt-4">
              <Label>Wetter</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {WEATHER.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleTag(idx, "weatherTags", w.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium",
                      leg.weatherTags.includes(w.id)
                        ? "border-amber-600 bg-amber-50 text-amber-900"
                        : "border-stone-200 bg-white text-stone-600"
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <Label>Dresscodes</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {DRESS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleTag(idx, "dressCodes", d.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium",
                      leg.dressCodes.includes(d.id)
                        ? "border-stone-800 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-600"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
        <h4 className="mb-2 font-semibold text-stone-800">
          Vorschau Berechnung ({preview.length} Einträge)
        </h4>
        <ul className="grid gap-1 text-sm text-stone-600 md:grid-cols-2">
          {preview.slice(0, 8).map((item) => (
            <li key={item.name}>
              {item.quantity}× {item.name}
              {item.isShared ? " · gemeinsam" : ""}
            </li>
          ))}
          {preview.length > 8 && (
            <li className="text-stone-400">+{preview.length - 8} weitere…</li>
          )}
        </ul>
      </div>

      <Button
        size="lg"
        disabled={busy || !legs.length}
        onClick={() =>
          onSubmit({
            title,
            startDate: rangeStart,
            endDate: rangeEnd,
            legs,
          })
        }
      >
        Packliste erstellen
      </Button>
    </div>
  );
}
