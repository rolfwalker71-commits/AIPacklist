"use client";

import { useState } from "react";
import Link from "next/link";
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

  const removeTrip = async (trip: TripListItem) => {
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
      const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Löschen fehlgeschlagen");
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
    <ul className="space-y-3">
      {trips.map((trip) => {
        const isOwner = trip.ownerId === userId;
        return (
          <SwipeRow
            key={trip.id}
            actions={[
              {
                id: "remove",
                label: isOwner ? "Löschen" : "Verlassen",
                tone: "danger",
                onClick: () => {
                  if (busyId) return;
                  void removeTrip(trip);
                },
              },
            ]}
          >
            <li className="list-none">
              <Link
                href={`/trip/${trip.id}`}
                className="card-surface block bg-white p-4 transition hover:border-teal-300 hover:shadow-md"
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
              </Link>
            </li>
          </SwipeRow>
        );
      })}
    </ul>
  );
}
