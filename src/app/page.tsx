import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { tripsForUserWhere } from "@/lib/trip-access";
import { TravelMotif } from "@/components/app/travel-motif";
import { BrandLogo } from "@/components/app/brand-logo";
import { TripList } from "@/components/app/trip-list";

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

  const tripItems = trips.map((trip) => ({
    id: trip.id,
    title: trip.title,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    inviteCode: trip.inviteCode,
    ownerId: trip.ownerId,
    _count: trip._count,
  }));

  return (
    <main className="mx-auto max-w-lg px-4 pb-6 pt-6 md:max-w-3xl md:pt-10">
      <header className="mb-6 flex items-center justify-between animate-rise">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-12 w-12 shrink-0" />
          <div>
            <p className="text-eyebrow text-teal-800/80">FlexiPack</p>
            <h1 className="font-display text-page-title text-stone-950">
              Hallo {user.name.split(" ")[0]}
            </h1>
          </div>
        </div>
        {user.role === "ADMIN" && (
          <Link href="/admin/users">
            <Button variant="ghost" size="icon" aria-label="Admin">
              <Shield className="h-5 w-5" />
            </Button>
          </Link>
        )}
      </header>

      <section className="hero-panel animate-rise px-5 py-8">
        <TravelMotif className="absolute -right-2 bottom-0 h-40 w-60 opacity-50" />
        <p className="text-eyebrow text-teal-100/75">Deine Reisen</p>
        <h2 className="mt-2 max-w-[15rem] font-display text-page-title leading-tight md:max-w-md">
          Packen ohne Chaos
        </h2>
        <p className="mt-3 max-w-sm text-base text-teal-50/90">
          Listen nach Person filtern, Etappen pflegen, Tipps der KI behalten.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/create">
            <Button
              size="lg"
              className="bg-amber-400 text-stone-950 hover:bg-amber-300"
            >
              Neue Reise <ArrowRight className="h-5 w-5" />
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
          <h2 className="font-display text-section-title text-stone-900">
            Reisen
          </h2>
          <Link href="/create" className="text-sm font-semibold text-teal-800">
            Neu
          </Link>
        </div>
        {tripItems.length === 0 ? (
          <div className="card-surface p-6 text-center">
            <TravelMotif className="mx-auto h-32 w-52 opacity-80" />
            <p className="mt-3 text-base text-stone-600">
              Noch keine Reise — starte eine Packliste oder tritt mit Code bei.
            </p>
          </div>
        ) : (
          <TripList trips={tripItems} userId={user.id} />
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
