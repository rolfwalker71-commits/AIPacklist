import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildTravelInsights } from "@/lib/ai-pack";
import {
  mergeInsights,
  parseAiInsights,
  stringifyAiInsights,
} from "@/lib/ai-insights";
import { isAiConfigured } from "@/lib/openai";
import { publish } from "@/lib/events";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import type { PackGender, TravelerProfile } from "@/lib/types";
import { notifyTripMembers } from "@/lib/push";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  try {
    if (!isAiConfigured()) {
      return NextResponse.json(
        {
          error:
            "OpenAI ist nicht konfiguriert. Unter /settings den Schlüssel hinterlegen.",
        },
        { status: 400 }
      );
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: tripInclude,
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const travelers: TravelerProfile[] = trip.members.map((m) => ({
      key: m.userId,
      name: m.user.name,
      gender: (m.user.gender as PackGender) || "UNSPECIFIED",
    }));

    const legs = trip.legs.map((leg) => ({
      name: leg.name,
      location: leg.location,
      startDate: leg.startDate.toISOString().slice(0, 10),
      endDate: leg.endDate.toISOString().slice(0, 10),
      transport: leg.transport,
      laundryAvailable: leg.laundryAvailable,
      laundryIntervalDays: leg.laundryIntervalDays,
      weatherTags: JSON.parse(leg.weatherTags) as never[],
      dressCodes: JSON.parse(leg.dressCodes) as never[],
    }));

    const insights = await buildTravelInsights({
      legs,
      travelers,
      title: trip.title,
    });

    if (!insights.tips.length && !insights.guides.length) {
      return NextResponse.json(
        { error: "KI konnte keine Tipps erzeugen." },
        { status: 502 }
      );
    }

    const next = mergeInsights(parseAiInsights(trip.aiInsights), {
      tips: insights.tips,
      guides: insights.guides,
    });

    await prisma.trip.update({
      where: { id: tripId },
      data: { aiInsights: stringifyAiInsights(next) },
    });

    const full = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: tripInclude,
    });
    publish({ type: "trip_updated", tripId });
    void notifyTripMembers(tripId, {
      title: trip.title.slice(0, 50),
      body: "Neue Reisetipps sind bereit.",
      url: `/trip/${tripId}?tab=ai`,
      tag: `tips-${tripId}`,
    });

    return NextResponse.json({
      ...serializeTrip(full),
      source: insights.source,
    });
  } catch (e) {
    console.error("ai-insights failed", e);
    const message =
      e instanceof Error ? e.message : "Unbekannter KI-Fehler";
    return NextResponse.json({ error: message.slice(0, 280) }, { status: 500 });
  }
}
