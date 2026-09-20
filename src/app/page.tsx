import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Share2, Shield, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { getSessionUser } from "@/lib/auth";
import { loadTripSummaries, type TripSummary } from "@/lib/trip-summary";
import { TravelMotif } from "@/components/app/travel-motif";
import { BrandLogo } from "@/components/app/brand-logo";
import { AvatarStack } from "@/components/app/avatar-stack";
import { TripList } from "@/components/app/trip-list";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The trip the hero should feature: next one starting, else latest. */
function featuredTrip(trips: TripSummary[]): TripSummary | null {
  if (trips.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = trips
    .filter((t) => t.endDate.slice(0, 10) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return upcoming[0] ?? trips[0];
}

function daysUntil(iso: string): number {
  const start = new Date(iso.slice(0, 10)).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round((start - today) / 86400000);
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let trips: TripSummary[] = [];
  try {
    trips = await loadTripSummaries(user.id);
  } catch {
    trips = [];
  }

  const hero = featuredTrip(trips);
  const heroPct =
    hero && hero.itemCount > 0
      ? Math.round((hero.packedCount / hero.itemCount) * 100)
      : 0;
  const heroDays = hero ? daysUntil(hero.startDate) : 0;
  const heroWhen =
    heroDays > 1
      ? `in ${heroDays} Tagen`
      : heroDays === 1
        ? "morgen"
        : heroDays === 0
          ? "heute"
          : "läuft";

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-8 pt-8 md:max-w-3xl lg:max-w-6xl lg:px-8 lg:pt-10">
      <header className="animate-rise mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="glass glass-thick flex h-12 w-12 shrink-0 items-center justify-center rounded-full pad:hidden">
            <BrandLogo className="h-8 w-8" />
          </span>
          <div>
            <p className="text-eyebrow text-primary">FlexiPack</p>
            <h1 className="font-display text-page-title text-foreground">
              Hallo {user.name.split(" ")[0]}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user.role === "ADMIN" && (
            <Link href="/admin/users">
              <Button variant="secondary" size="icon" aria-label="Admin">
                <Shield className="h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </header>

      {hero ? (
        <section className="hero-panel animate-rise px-5 py-7 md:px-8 md:py-9">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(70%_100%_at_92%_112%,rgba(251,191,36,0.45),transparent_62%)]"
          />
          <TravelMotif className="pointer-events-none absolute -right-4 bottom-0 h-36 w-56 opacity-35 md:h-44 md:w-72" />

          <div className="relative md:flex md:items-end md:justify-between md:gap-10">
            <div className="md:max-w-xl">
              <p className="text-eyebrow text-[rgba(209,250,229,0.8)]">
                Nächste Reise · {heroWhen}
              </p>
              <h2 className="mt-2 font-display text-page-title md:text-[2.6rem]">
                {hero.title}
              </h2>
              <p className="mt-2.5 text-base text-[rgba(236,253,245,0.88)]">
                {formatDate(hero.startDate)} – {formatDate(hero.endDate)} ·{" "}
                {hero.legCount} Etappen · {hero.memberCount} Personen
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href={`/trip/${hero.id}`}>
                  <Button variant="accent" size="lg">
                    Weiterpacken <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href={`/trip/${hero.id}`}>
                  <Button
                    size="lg"
                    className="border-none bg-[rgba(255,255,255,0.16)] text-[#effefb] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_0_1px_rgba(255,255,255,0.20)]"
                  >
                    <Share2 className="h-4 w-4" />
                    {hero.inviteCode}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-7 w-full md:mt-0 md:w-64 md:shrink-0">
              <div className="mb-2 flex items-baseline justify-between text-sm font-semibold text-[rgba(236,253,245,0.92)]">
                <span>
                  {hero.packedCount} / {hero.itemCount} gepackt
                </span>
                <span>{heroPct} %</span>
              </div>
              <div className="track bg-[rgba(255,255,255,0.22)]">
                <span
                  style={{
                    width: `${heroPct}%`,
                    background: "linear-gradient(90deg,#fcd34d,#5eead4)",
                  }}
                />
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <AvatarStack people={hero.members} size="md" />
                <span className="text-sm text-[rgba(236,253,245,0.85)]">
                  {hero.memberCount === 1
                    ? "Du packst allein"
                    : `${hero.memberCount} packen mit`}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="glass glass-float animate-rise rounded-[var(--r-xl)] p-7 text-center">
          <TravelMotif className="mx-auto h-32 w-52 opacity-80" />
          <h2 className="mt-4 font-display text-section-title text-foreground">
            Noch keine Reise
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-base text-muted-foreground">
            Starte eine Packliste oder tritt mit einem Einladungscode bei.
          </p>
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link href="/create" className="min-w-0 flex-1">
          <Button variant="secondary" className="w-full">
            Neue Reise
          </Button>
        </Link>
        <Link href="/join" className="min-w-0 flex-1">
          <Button variant="secondary" className="w-full">
            <UserPlus className="h-4 w-4" />
            Beitreten
          </Button>
        </Link>
      </div>

      <section
        className="animate-rise mt-9"
        style={{ animationDelay: "0.08s" }}
      >
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-section-title text-foreground">
              Alle Reisen
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Nach links wischen zum Löschen
            </p>
          </div>
          <Link
            href="/create"
            className="text-sm font-semibold text-primary"
          >
            Neu
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="glass rounded-[var(--r-lg)] p-6 text-center">
            <p className="text-base text-muted-foreground">
              Noch keine Reise — starte eine Packliste oder tritt mit Code bei.
            </p>
          </div>
        ) : (
          <TripList trips={trips} userId={user.id} />
        )}
      </section>
    </main>
  );
}
