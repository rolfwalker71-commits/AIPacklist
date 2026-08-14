import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";
import { fetchLegWeather } from "@/lib/weather";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import { publish } from "@/lib/events";

/** Fetch Open-Meteo forecast for one or all legs and update weatherTags. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(user.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const legId =
      typeof (body as { legId?: string }).legId === "string"
        ? (body as { legId: string }).legId
        : null;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { legs: { orderBy: { sortOrder: "asc" } } },
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const legs = legId
      ? trip.legs.filter((l) => l.id === legId)
      : trip.legs;

    if (!legs.length) {
      return NextResponse.json({ error: "Keine Etappe" }, { status: 400 });
    }

    const results: { legId: string; ok: boolean; error?: string }[] = [];

    for (const leg of legs) {
      if (!leg.location?.trim()) {
        results.push({
          legId: leg.id,
          ok: false,
          error: "Kein Ort hinterlegt",
        });
        continue;
      }
      try {
        const weather = await fetchLegWeather({
          location: leg.location,
          startDate: leg.startDate,
          endDate: leg.endDate,
        });
        if (!weather) {
          results.push({
            legId: leg.id,
            ok: false,
            error: "Ort nicht gefunden / keine Prognose",
          });
          continue;
        }
        await prisma.leg.update({
          where: { id: leg.id },
          data: {
            weatherTags: JSON.stringify(weather.tags),
            weatherSummary: JSON.stringify(weather.summary),
          },
        });
        results.push({ legId: leg.id, ok: true });
      } catch (e) {
        results.push({
          legId: leg.id,
          ok: false,
          error: e instanceof Error ? e.message : "Fehler",
        });
      }
    }

    const full = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: tripInclude,
    });
    publish({ type: "trip_updated", tripId });

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      ...serializeTrip(full),
      weatherResults: results,
      message:
        okCount === 0
          ? "Wetter konnte nicht geladen werden."
          : `${okCount} Etappe(n) aktualisiert. Packliste bei Bedarf neu berechnen.`,
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
