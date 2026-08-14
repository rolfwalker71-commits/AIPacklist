"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SwipeRow } from "@/components/ui/swipe-row";
import { formatDate } from "@/lib/utils";

export type TripListItem = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  inviteCode: string;
  ownerId: string;
  _count: { legs: number; items: number; members: number };
};

export function TripList({
  trips: initial,
  userId,
}: {
  trips: TripListItem[];
  userId: string;
}) {
  const router = useRouter();
  const [trips, setTrips] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setTrips(initial);
  }, [initial]);

  const openTrip = (tripId: string) => {
    router.push(`/trip/${tripId}`);
  };

  const removeTrip = async (trip: TripListItem) => {
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

  if (trips.length === 0) return null;

  return (
    <ul className="space-y-3">
      {trips.map((trip) => {
        const isOwner = trip.ownerId === userId;
        return (
          <li key={trip.id} className="list-none">
            <SwipeRow
              className="rounded-[1.25rem]"
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
                onClick={() => openTrip(trip.id)}
                className="card-surface block w-full select-none bg-white p-4 text-left transition hover:border-teal-300 hover:shadow-md disabled:opacity-60"
              >
                <div className="font-display text-section-title text-stone-900">
                  {trip.title}
                </div>
                <div className="mt-1.5 text-base text-stone-500">
                  {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
                  {trip._count.legs} Etappen · {trip._count.items} Items
                </div>
                <div className="mt-2 text-sm font-semibold text-teal-800">
                  {trip._count.members} Personen · Code {trip.inviteCode}
                  {!isOwner ? " · Beigetreten" : ""}
                </div>
              </button>
            </SwipeRow>
          </li>
        );
      })}
    </ul>
  );
}
