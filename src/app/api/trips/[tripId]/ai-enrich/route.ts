import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enrichPackListWithAi } from "@/lib/ai-pack";
import {
  mergeInsights,
  parseAiInsights,
  stringifyAiInsights,
} from "@/lib/ai-insights";
import { isAiConfigured } from "@/lib/openai";
import { publish } from "@/lib/events";
import { serializeTrip, tripInclude, ensureAllMembersPackKits } from "@/lib/trip-service";
import type { PackGender, TravelerProfile } from "@/lib/types";

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

    // Fill personal kits for any member who joined later (2nd, 3rd, Kind, …)
    await ensureAllMembersPackKits(tripId);

    const tripFresh = await prisma.trip.findUnique({
      where: { id: tripId },
      include: tripInclude,
    });
    if (!tripFresh) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const travelers: TravelerProfile[] = tripFresh.members.map((m) => ({
      key: m.userId,
      name: m.user.name,
      gender: (m.user.gender as PackGender) || "UNSPECIFIED",
    }));

    const legs = tripFresh.legs.map((leg) => ({
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

    const existing = tripFresh.items.map((i) => ({
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      isShared: i.isShared,
      priority: i.priority as "EARLY" | "NORMAL" | "DAY_OF",
      notes: i.notes || undefined,
      source: (i.source as "calculator") || "calculator",
    }));

    const enriched = await enrichPackListWithAi({
      legs,
      travelers,
      existing,
    });

    const sharedBag = tripFresh.suitcases.find((s) => s.isShared);
    const personalBags = tripFresh.suitcases.filter((s) => !s.isShared);

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
          priority: item.priority || "NORMAL",
          notes: item.notes,
          source: "ai",
          suitcaseId: suitcaseId || null,
        },
      });
    }

    if (enriched.tips.length || enriched.guides.length) {
      const next = mergeInsights(parseAiInsights(tripFresh.aiInsights), {
        tips: enriched.tips,
        guides: enriched.guides,
      });
      await prisma.trip.update({
        where: { id: tripId },
        data: { aiInsights: stringifyAiInsights(next) },
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
      guides: enriched.guides,
      added: enriched.items.length,
    });
  } catch (e) {
    console.error("ai-enrich failed", e);
    const message =
      e instanceof Error ? e.message : "Unbekannter KI-/Datenbankfehler";
    return NextResponse.json(
      { error: message.slice(0, 280) },
      { status: 500 }
    );
  }
}
