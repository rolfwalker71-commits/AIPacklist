import Link from "next/link";
import { ArrowRight, Luggage, Users, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let trips: Awaited<ReturnType<typeof loadTrips>> = [];
  try {
    trips = await loadTrips();
  } catch {
    trips = [];
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:pt-14">
      <nav className="mb-10 flex items-center justify-between animate-rise">
        <div className="font-display text-2xl tracking-tight text-teal-900">
          FlexiPack
        </div>
        <div className="flex gap-2">
          <Link href="/join">
            <Button variant="outline" size="sm">
              Beitreten
            </Button>
          </Link>
          <Link href="/create">
            <Button size="sm">
              Neue Liste <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden rounded-[2rem] border border-teal-900/10 bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 px-6 py-12 text-teal-50 shadow-xl md:px-12 md:py-16 animate-rise">
        <div className="absolute right-6 top-6 animate-drift opacity-30 md:right-12 md:top-10">
          <Waves className="h-24 w-24" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-100/80">
          PWA · Desktop · Multi-User
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-tight md:text-6xl">
          FlexiPack
        </h1>
        <p className="mt-4 max-w-xl text-base text-teal-50/85 md:text-lg">
          Packlisten für Multi-Etappen-Reisen, Paare und Gruppen — mit
          Wasch-Logik, Shared Items in Echtzeit.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/create">
            <Button
              size="lg"
              className="bg-amber-500 text-stone-950 hover:bg-amber-400"
            >
              Packliste starten
            </Button>
          </Link>
          <Link href="/create?mode=templates">
            <Button
              size="lg"
              variant="outline"
              className="border-teal-200/40 bg-teal-950/20 text-teal-50 hover:bg-teal-950/40"
            >
              Templates
            </Button>
          </Link>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3 animate-rise" style={{ animationDelay: "0.1s" }}>
        {[
          {
            icon: Waves,
            title: "3 Eingabe-Modi",
            text: "Visual Wizard, Vibe Input und modulare Templates.",
          },
          {
            icon: Users,
            title: "Couple & Gruppe",
            text: "Shared Items live abhaken — sichtbar für alle Mitreisenden.",
          },
          {
            icon: Luggage,
            title: "Cross-Packing",
            text: "Items auf Koffer verteilen für den Fall von Gepäckverlust.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-stone-200/80 bg-white/70 p-5 backdrop-blur"
          >
            <f.icon className="mb-3 h-5 w-5 text-teal-800" />
            <h2 className="font-display text-lg text-stone-900">{f.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl text-stone-900">Deine Reisen</h2>
          <Link href="/create" className="text-sm font-semibold text-teal-800">
            Neu anlegen
          </Link>
        </div>
        {trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-12 text-center text-stone-500">
            Noch keine Packlisten. Starte mit Wizard, Vibe Input oder Template.
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trip/${trip.id}`}
                  className="block rounded-2xl border border-stone-200 bg-white/80 p-5 transition hover:border-teal-300 hover:shadow-md"
                >
                  <div className="font-display text-xl text-stone-900">
                    {trip.title}
                  </div>
                  <div className="mt-1 text-sm text-stone-500">
                    {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
                    {trip._count.legs} Legs · {trip._count.items} Items ·{" "}
                    {trip._count.members} Personen
                  </div>
                  <div className="mt-2 text-xs text-teal-800">
                    Invite {trip.inviteCode} · {trip.owner.name}
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

async function loadTrips() {
  return prisma.trip.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      owner: true,
      _count: { select: { items: true, members: true, legs: true } },
    },
    take: 20,
  });
}
