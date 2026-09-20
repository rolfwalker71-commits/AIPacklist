"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Search, X } from "lucide-react";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Segment, Segmented } from "@/components/ui/segmented";
import { Badge } from "@/components/ui/badge";
import { Track } from "@/components/ui/glass";
import { AvatarStack } from "@/components/app/avatar-stack";
import { inputClass } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import type { TripSummary } from "@/lib/trip-summary";

export type TripListItem = TripSummary;

type SortKey = "date" | "title" | "progress";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "date", label: "Datum" },
  { id: "progress", label: "Fortschritt" },
  { id: "title", label: "Name" },
];

const TRANSPORT_LABEL: Record<string, string> = {
  SHIP: "Schiff",
  FLIGHT: "Flug",
  CAR: "Auto",
  TRAIN: "Zug",
  OTHER: "Sonstiges",
};

function pct(trip: TripSummary) {
  if (trip.itemCount === 0) return 0;
  return Math.round((trip.packedCount / trip.itemCount) * 100);
}

export function TripList({
  trips: initial,
  userId,
}: {
  trips: TripSummary[];
  userId: string;
}) {
  const router = useRouter();
  const [trips, setTrips] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("date");

  useEffect(() => {
    setTrips(initial);
  }, [initial]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? trips.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.inviteCode.toLowerCase().includes(q) ||
            t.members.some((m) => m.name.toLowerCase().includes(q))
        )
      : trips;

    return [...filtered].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "de");
      if (sort === "progress") return pct(b) - pct(a);
      return b.startDate.localeCompare(a.startDate);
    });
  }, [trips, query, sort]);

  const removeTrip = async (trip: TripSummary) => {
    if (busyId) return;
    const isOwner = trip.ownerId === userId;
    const ok = window.confirm(
      isOwner
        ? `Reise «${trip.title}» wirklich löschen? Das kann nicht rückgängig gemacht werden.`
        : `Reise «${trip.title}» verlassen?`
    );
    if (!ok) return;

    setBusyId(trip.id);
    const prev = trips;
    setTrips((list) => list.filter((t) => t.id !== trip.id));
    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Löschen fehlgeschlagen"
        );
      }
      router.refresh();
    } catch (e) {
      setTrips(prev);
      window.alert(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Reise, Code oder Person suchen"
            aria-label="Reisen durchsuchen"
            className={cn(inputClass, "h-11 pl-10 pr-10")}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Suche leeren"
              className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-subtle hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Segmented label="Sortierung" className="self-start xl:self-auto">
          <span className="flex items-center pl-2 pr-1 text-subtle">
            <ArrowUpDown className="h-3.5 w-3.5" />
          </span>
          {SORTS.map((s) => (
            <Segment
              key={s.id}
              active={sort === s.id}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </Segment>
          ))}
        </Segmented>
      </div>

      {visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-base text-muted-foreground">
          Keine Reise passt zu «{query}».
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((trip) => {
            const isOwner = trip.ownerId === userId;
            const progress = pct(trip);
            return (
              <li key={trip.id} className="list-none">
                <SwipeRow
                  className="rounded-[var(--r-lg)]"
                  actions={[
                    {
                      id: "remove",
                      label: isOwner ? "Löschen" : "Verlassen",
                      tone: "danger",
                      onClick: () => {
                        void removeTrip(trip);
                      },
                    },
                  ]}
                >
                  <button
                    type="button"
                    disabled={busyId === trip.id}
                    onClick={() => router.push(`/trip/${trip.id}`)}
                    className="glass glass-press block w-full select-none rounded-[var(--r-lg)] p-4 text-left disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-card-title text-foreground">
                          {trip.title}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                          {" · "}
                          {trip.legCount} Etappen · {trip.itemCount} Items
                        </div>
                      </div>
                      <AvatarStack people={trip.members} />
                    </div>

                    <div className="mt-3 flex items-center gap-2.5">
                      <Track pct={progress} slim className="flex-1" />
                      <span className="shrink-0 text-xs font-bold text-subtle">
                        {progress} %
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {trip.transports.slice(0, 2).map((t) => (
                        <Badge key={t} variant="secondary">
                          {TRANSPORT_LABEL[t] || t}
                        </Badge>
                      ))}
                      {trip.hasGala && <Badge variant="warning">Gala</Badge>}
                      <Badge variant="muted">Code {trip.inviteCode}</Badge>
                      {!isOwner && <Badge variant="outline">Beigetreten</Badge>}
                    </div>
                  </button>
                </SwipeRow>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
