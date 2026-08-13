import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Luggage, Users, Waves, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import { tripsForUserWhere } from "@/lib/trip-access";
import { LogoutButton } from "@/components/auth/logout-button";

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
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:pt-14">
      <nav className="mb-10 flex flex-wrap items-center justify-between gap-3 animate-rise">
        <div className="font-display text-2xl tracking-tight text-teal-900">
          FlexiPack
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-sm text-stone-600 sm:inline">
            {user.name}{" "}
            <span className="text-stone-400">@{user.username}</span>
          </span>
          {user.role === "ADMIN" && (
            <Link href="/admin/users">
              <Button variant="ghost" size="sm">
                <Shield className="h-4 w-4" />
                Benutzer
              </Button>
            </Link>
          )}
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              KI
            </Button>
          </Link>
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
          <LogoutButton />
        </div>
      </nav>

      <section className="relative overflow-hidden rounded-[2rem] border border-teal-900/10 bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 px-6 py-12 text-teal-50 shadow-xl md:px-12 md:py-16 animate-rise">
        <div className="absolute right-6 top-6 animate-drift opacity-30 md:right-12 md:top-10">
          <Waves className="h-24 w-24" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-100/80">
          Geschützt · Deine Reisen
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-tight md:text-6xl">
          FlexiPack
        </h1>
        <p className="mt-4 max-w-xl text-base text-teal-50/85 md:text-lg">
          Hallo {user.name} — hier siehst du nur Reisen, an denen du beteiligt
          bist. Partner:innen brauchen ein eigenes Konto (vom Admin angelegt)
          und den Einladungscode.
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
              Vorlagen
            </Button>
          </Link>
        </div>
      </section>

      <section
        className="mt-12 grid gap-4 md:grid-cols-3 animate-rise"
        style={{ animationDelay: "0.1s" }}
      >
        {[
          {
            icon: Waves,
            title: "Etappen & Orte",
            text: "Mehrstufige Reisen mit Region, Wäsche und Prioritäten.",
          },
          {
            icon: Users,
            title: "Getrennte Konten",
            text: "Jeder User hat eigene Trips — Einladung nur gezielt.",
          },
          {
            icon: Luggage,
            title: "Gemeinsam packen",
            text: "Live-Status, Koffer und farbige Zuordnung pro Person.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-stone-200 bg-white/70 p-5"
          >
            <f.icon className="h-5 w-5 text-teal-800" />
            <h2 className="mt-3 font-display text-lg text-stone-900">
              {f.title}
            </h2>
            <p className="mt-1 text-sm text-stone-600">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 animate-rise" style={{ animationDelay: "0.15s" }}>
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl text-stone-900">Deine Reisen</h2>
          <Link href="/create" className="text-sm font-semibold text-teal-800">
            Neu erstellen
          </Link>
        </div>
        {trips.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white/50 p-8 text-center text-stone-600">
            Noch keine Reise — starte eine Packliste oder tritt mit Code bei.
          </p>
        ) : (
          <ul className="space-y-3">
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
                    {trip._count.legs} Etappen · {trip._count.items} Einträge ·{" "}
                    {trip._count.members} Personen
                  </div>
                  <div className="mt-2 text-xs text-teal-800">
                    Einladung {trip.inviteCode} · {trip.owner.name}
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
