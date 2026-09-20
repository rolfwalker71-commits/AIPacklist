import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { tripsForUserWhere } from "@/lib/trip-access";
import { parseAiInsights, type AiGuide } from "@/lib/ai-insights";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TipsMotif } from "@/components/app/travel-motif";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type TripTips = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  updatedAt: string | null;
  tips: string[];
  guides: AiGuide[];
};

async function loadTips(userId: string): Promise<TripTips[]> {
  const trips = await prisma.trip.findMany({
    where: tripsForUserWhere(userId),
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      aiInsights: true,
    },
    take: 40,
  });

  return trips
    .map((trip) => {
      const insights = parseAiInsights(trip.aiInsights);
      return {
        id: trip.id,
        title: trip.title,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        updatedAt: insights.updatedAt ?? null,
        tips: insights.tips,
        guides: insights.guides,
      };
    })
    .filter((t) => t.tips.length > 0 || t.guides.length > 0);
}

export default async function TippsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let trips: TripTips[] = [];
  try {
    trips = await loadTips(user.id);
  } catch {
    trips = [];
  }

  const tipCount = trips.reduce((n, t) => n + t.tips.length, 0);
  const guideCount = trips.reduce((n, t) => n + t.guides.length, 0);

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-8 pt-8 md:max-w-3xl lg:max-w-5xl lg:px-8 lg:pt-10">
      <header className="animate-rise mb-6">
        <p className="text-eyebrow text-primary">Wissen</p>
        <h1 className="mt-1.5 font-display text-page-title text-foreground">
          Tipps &amp; Ratgeber
        </h1>
        <p className="mt-2 max-w-xl text-base text-muted-foreground">
          Alles, was die KI auf deinen Reisen gesammelt hat — an einem Ort.
          {tipCount + guideCount > 0 && (
            <>
              {" "}
              {tipCount} {tipCount === 1 ? "Tipp" : "Tipps"} und {guideCount}{" "}
              {guideCount === 1 ? "Guide" : "Guides"} aus {trips.length}{" "}
              {trips.length === 1 ? "Reise" : "Reisen"}.
            </>
          )}
        </p>
      </header>

      {trips.length === 0 ? (
        <section className="glass glass-float animate-rise rounded-[var(--r-xl)] p-7 text-center">
          <TipsMotif className="mx-auto h-28 w-auto max-w-[240px] opacity-90" />
          <h2 className="mt-4 font-display text-section-title text-foreground">
            Noch keine Tipps gespeichert
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-base text-muted-foreground">
            Öffne eine Reise und lass unter «Tipps» Reisetipps generieren — sie
            erscheinen dann hier über alle Reisen hinweg.
          </p>
          <Link href="/" className="mt-5 inline-block">
            <Button variant="secondary">
              Zu den Reisen <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      ) : (
        <div className="space-y-6">
          {trips.map((trip, i) => (
            <section
              key={trip.id}
              className="animate-rise space-y-3"
              style={{ animationDelay: `${Math.min(i, 5) * 0.05}s` }}
            >
              <div className="flex flex-wrap items-end justify-between gap-2 px-1">
                <div className="min-w-0">
                  <h2 className="font-display text-section-title text-foreground">
                    {trip.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                    {trip.updatedAt
                      ? ` · aktualisiert ${formatDate(trip.updatedAt)}`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/trip/${trip.id}`}
                  className="text-sm font-semibold text-primary"
                >
                  Reise öffnen
                </Link>
              </div>

              {trip.tips.length > 0 && (
                <div className="glass tint-teal rounded-[var(--r-lg)] p-4 sm:p-5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-card-title text-foreground">
                      Tipps
                    </h3>
                    <Badge variant="muted">{trip.tips.length}</Badge>
                  </div>
                  <ul className="space-y-2">
                    {trip.tips.map((tip) => (
                      <li key={tip} className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        />
                        <span className="text-base text-muted-foreground">
                          {tip}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trip.guides.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {trip.guides.map((guide) => (
                    <article
                      key={`${trip.id}-${guide.title}`}
                      className="glass rounded-[var(--r-lg)] p-4 sm:p-5"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                        <h4 className="font-display text-card-title text-foreground">
                          {guide.title}
                        </h4>
                      </div>
                      {guide.body.split(/\n+/).map((para, idx) => (
                        <p
                          key={idx}
                          className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                        >
                          {para}
                        </p>
                      ))}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
