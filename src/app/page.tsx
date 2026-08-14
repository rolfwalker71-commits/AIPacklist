import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import { tripsForUserWhere } from "@/lib/trip-access";
import { TravelMotif } from "@/components/app/travel-motif";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let trips: Awaited<ReturnType<typeof loadTrips>> = [];
  try {
    trips = await loadTrips(user.id);
  } catch {
    trips = [];
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-6 pt-6 md:max-w-3xl md:pt-10">
      <header className="mb-6 flex items-center justify-between animate-rise">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-800/80">
            FlexiPack
          </p>
          <h1 className="font-display text-2xl text-stone-950 md:text-3xl">
            Hallo {user.name.split(" ")[0]}
          </h1>
        </div>
        {user.role === "ADMIN" && (
          <Link href="/admin/users">
            <Button variant="ghost" size="sm">
              <Shield className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </header>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 px-5 py-8 text-teal-50 shadow-xl animate-rise">
        <TravelMotif className="absolute -right-2 bottom-0 h-36 w-56 opacity-50" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100/75">
          Deine Reisen
        </p>
        <h2 className="mt-2 max-w-[14rem] font-display text-3xl leading-tight md:max-w-md md:text-4xl">
          Packen ohne Chaos
        </h2>
        <p className="mt-3 max-w-sm text-sm text-teal-50/85">
          Listen nach Person filtern, Etappen pflegen, Tipps der KI behalten.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/create">
            <Button
              size="lg"
              className="bg-amber-400 text-stone-950 hover:bg-amber-300"
            >
              Neue Reise <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/join">
            <Button
              size="lg"
              variant="outline"
              className="border-teal-200/40 bg-teal-950/25 text-teal-50 hover:bg-teal-950/40"
            >
              Beitreten
            </Button>
          </Link>
        </div>
      </section>

      <section className="mt-8 animate-rise" style={{ animationDelay: "0.08s" }}>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl text-stone-900">Reisen</h2>
          <Link href="/create" className="text-xs font-semibold text-teal-800">
            Neu
          </Link>
        </div>
        {trips.length === 0 ? (
          <div className="card-surface rounded-2xl p-6 text-center">
            <TravelMotif className="mx-auto h-28 w-48 opacity-80" />
            <p className="mt-2 text-sm text-stone-600">
              Noch keine Reise — starte eine Packliste oder tritt mit Code bei.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trip/${trip.id}`}
                  className="card-surface block rounded-2xl p-4 shadow-sm transition hover:border-teal-300 hover:shadow-md"
                >
                  <div className="font-display text-xl text-stone-900">
                    {trip.title}
                  </div>
                  <div className="mt-1 text-sm text-stone-500">
                    {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
                    {trip._count.legs} Etappen · {trip._count.items} Items
                  </div>
                  <div className="mt-2 text-xs font-medium text-teal-800">
                    {trip._count.members} Personen · Code {trip.inviteCode}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

async function loadTrips(userId: string) {
  return prisma.trip.findMany({
    where: tripsForUserWhere(userId),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: true,
      _count: { select: { items: true, members: true, legs: true } },
    },
    take: 20,
  });
}
