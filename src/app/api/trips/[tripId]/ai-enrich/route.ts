import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enrichPackListWithAi } from "@/lib/ai-pack";
import { isAiConfigured } from "@/lib/openai";
import { publish } from "@/lib/events";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import type { PackGender, TravelerProfile } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "OpenAI ist nicht konfiguriert. Unter /settings den Schlüssel hinterlegen." },
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
    startDate: leg.startDate.toISOString().slice(0, 10),
    endDate: leg.endDate.toISOString().slice(0, 10),
    transport: leg.transport,
    laundryAvailable: leg.laundryAvailable,
    laundryIntervalDays: leg.laundryIntervalDays,
    weatherTags: JSON.parse(leg.weatherTags) as never[],
    dressCodes: JSON.parse(leg.dressCodes) as never[],
  }));

  const existing = trip.items.map((i) => ({
    name: i.name,
    category: i.category,
    quantity: i.quantity,
    isShared: i.isShared,
    notes: i.notes || undefined,
    source: (i.source as "calculator") || "calculator",
  }));

  const enriched = await enrichPackListWithAi({
    legs,
    travelers,
    existing,
  });

  if (!enriched.items.length) {
    return NextResponse.json({
      ...serializeTrip(trip),
      tips: enriched.tips,
      added: 0,
    });
  }

  const sharedBag = trip.suitcases.find((s) => s.isShared);
  const personalBags = trip.suitcases.filter((s) => !s.isShared);

  for (const item of enriched.items) {
    const owner =
      !item.isShared && item.assigneeKey
        ? travelers.find((t) => t.key === item.assigneeKey)
        : undefined;
    const suitcaseId = item.isShared
      ? sharedBag?.id
      : personalBags.find((b) => b.ownerUserId === owner?.key)?.id ||
        personalBags[0]?.id ||
        sharedBag?.id;

    await prisma.packItem.create({
      data: {
        tripId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        isShared: item.isShared,
        notes: item.notes,
        source: "ai",
        suitcaseId: suitcaseId || null,
      },
    });
  }

  const full = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: tripInclude,
  });
  publish({ type: "trip_updated", tripId });

  return NextResponse.json({
    ...serializeTrip(full),
    tips: enriched.tips,
    added: enriched.items.length,
  });
}
