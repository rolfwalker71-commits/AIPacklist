"use client";

import {
  ChecklistMotif,
  SuitcaseCardArt,
  TipsMotif,
  TeamMotif,
} from "@/components/app/travel-motif";
import { BrandLogo } from "@/components/app/brand-logo";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { computePackProgress } from "@/lib/pack-progress";
import { WEATHER_TAG_LABELS } from "@/lib/weather";
import type { WeatherTag } from "@/lib/types";
import { Printer } from "lucide-react";

type MemberUser = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
};

type PrintTrip = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  aiInsights?: {
    tips?: string[];
    guides?: { title: string; body: string }[];
  };
  legs: {
    name: string;
    location?: string | null;
    startDate: string;
    endDate: string;
    transport: string;
    weatherTags?: string[];
    weatherSummary?: { label: string } | null;
  }[];
  members: { user: MemberUser }[];
  suitcases: {
    id: string;
    name: string;
    size: string;
    isShared: boolean;
    ownerUserId: string | null;
    owner?: MemberUser | null;
  }[];
  items: {
    id: string;
    name: string;
    category: string;
    quantity: number;
    isShared: boolean;
    ownerUserId?: string | null;
    notes: string | null;
    packedAt: string | null;
    suitcaseId: string | null;
    suitcase?: {
      id: string;
      isShared?: boolean;
      ownerUserId?: string | null;
      owner?: MemberUser | null;
    } | null;
  }[];
};

export function PrintTripView({ trip }: { trip: PrintTrip }) {
  const progress = computePackProgress(trip.items, trip);
  const byCategory = new Map<string, typeof trip.items>();
  for (const item of trip.items) {
    const cat = item.category || "Sonstiges";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }

  return (
    <div className="space-y-8 text-stone-900">
      <div className="print:hidden flex flex-wrap gap-2">
        <Button type="button" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Drucken / als PDF speichern
        </Button>
      </div>

      <header className="relative overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-teal-50 to-white p-5">
        <ChecklistMotif className="absolute -right-1 bottom-0 h-24 w-36 opacity-40 print:opacity-50" />
        <div className="relative flex items-start gap-3">
          <BrandLogo className="h-12 w-12 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              FlexiPack
            </p>
            <h1 className="font-display text-3xl text-stone-950">{trip.title}</h1>
            <p className="mt-1 text-stone-600">
              {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
              {progress.packed}/{progress.total} gepackt ({progress.pct}%)
            </p>
          </div>
        </div>
      </header>

      <section className="break-inside-avoid">
        <div className="mb-3 flex items-center gap-3">
          <TeamMotif className="h-14 w-20 opacity-80" />
          <h2 className="font-display text-xl">Team & Fortschritt</h2>
        </div>
        <ul className="space-y-1 text-sm">
          {progress.byMember.map((m) => (
            <li key={m.userId}>
              <strong>{m.name}</strong>: {m.packed}/{m.total} ({m.pct}%)
            </li>
          ))}
          {progress.shared.total > 0 && (
            <li>
              <strong>Gemeinsam</strong>: {progress.shared.packed}/
              {progress.shared.total} ({progress.shared.pct}%)
            </li>
          )}
        </ul>
      </section>

      <section className="break-inside-avoid">
        <div className="mb-3 flex items-center gap-3">
          <ChecklistMotif className="h-14 w-20 opacity-80" />
          <h2 className="font-display text-xl">Route</h2>
        </div>
        <ul className="space-y-2 text-sm">
          {trip.legs.map((leg, i) => (
            <li key={`${leg.name}-${i}`} className="rounded-lg border border-stone-200 p-3">
              <strong>{leg.name}</strong>
              {leg.location ? ` · ${leg.location}` : ""}
              <div className="text-stone-600">
                {formatDate(leg.startDate)} – {formatDate(leg.endDate)}
              </div>
              {leg.weatherSummary?.label && (
                <div className="text-teal-900">{leg.weatherSummary.label}</div>
              )}
              {(leg.weatherTags || []).length > 0 && (
                <div className="text-stone-500">
                  {(leg.weatherTags || [])
                    .map((t) => WEATHER_TAG_LABELS[t as WeatherTag] || t)
                    .join(", ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <ChecklistMotif className="h-14 w-20 opacity-80" />
          <h2 className="font-display text-xl">Packliste</h2>
        </div>
        {[...byCategory.entries()].map(([cat, items]) => (
          <div key={cat} className="mb-4 break-inside-avoid">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal-800">
              {cat}
            </h3>
            <ul className="space-y-1">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 border-b border-stone-100 py-1.5 text-sm"
                >
                  <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded border border-stone-400">
                    {item.packedAt ? "✓" : ""}
                  </span>
                  <span>
                    {item.quantity}× {item.name}
                    {item.isShared ? " · Gemeinsam" : ""}
                    {item.notes ? (
                      <span className="text-stone-500"> — {item.notes}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="break-inside-avoid">
        <div className="mb-3 flex items-center gap-3">
          <SuitcaseCardArt className="h-14 w-20 opacity-80" />
          <h2 className="font-display text-xl">Koffer</h2>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {trip.suitcases.map((s) => {
            const count = trip.items.filter((i) => i.suitcaseId === s.id).length;
            const packed = trip.items.filter(
              (i) => i.suitcaseId === s.id && i.packedAt
            ).length;
            return (
              <li
                key={s.id}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <strong>{s.name}</strong>
                <div className="text-stone-600">
                  {packed}/{count} · {s.size}
                  {s.isShared ? " · Gemeinsam" : ""}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {(trip.aiInsights?.tips?.length || 0) > 0 && (
        <section className="break-inside-avoid">
          <div className="mb-3 flex items-center gap-3">
            <TipsMotif className="h-14 w-20 opacity-80" />
            <h2 className="font-display text-xl">Tipps</h2>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
            {(trip.aiInsights?.tips || []).slice(0, 20).map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
