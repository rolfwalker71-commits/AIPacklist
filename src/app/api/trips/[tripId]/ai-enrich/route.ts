import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enrichPackListWithAi, buildTravelInsights } from "@/lib/ai-pack";
import {
  mergeInsights,
  parseAiInsights,
  stringifyAiInsights,
} from "@/lib/ai-insights";
import { isAiConfigured } from "@/lib/openai";
import { publish } from "@/lib/events";
import {
  serializeTrip,
  tripInclude,
  ensureAllMembersPackKits,
} from "@/lib/trip-service";
import type { PackGender, TravelerProfile } from "@/lib/types";
import {
  analyzeCapacity,
  assignNewItems,
  pickSuitcaseForItem,
  softCapacityFor,
  type BagForAssign,
} from "@/lib/suitcase-capacity";
import { notifyTripMembers } from "@/lib/push";

export async function POST(
  req: NextRequest,
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

    const body = await req.json().catch(() => ({}));
    const alsoInsights = Boolean(
      (body as { alsoInsights?: boolean }).alsoInsights
    );
    const rebalance = Boolean(
      (body as { rebalance?: boolean }).rebalance ?? true
    );

    await ensureAllMembersPackKits(tripId, { skipBasics: true });

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

    const existing = tripFresh.items.map((i) => {
      const noteMatch = i.notes?.match(/für\s+([^·]+)/i);
      const fromNote = noteMatch
        ? travelers.find(
            (t) => t.name.toLowerCase() === noteMatch[1].trim().toLowerCase()
          )?.key
        : null;
      const bag = tripFresh.suitcases.find((s) => s.id === i.suitcaseId);
      const fromBag =
        bag && !bag.isShared && bag.ownerUserId ? bag.ownerUserId : null;
      return {
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        isShared: i.isShared,
        priority: i.priority as "EARLY" | "NORMAL" | "DAY_OF",
        notes: i.notes || undefined,
        source: (i.source as "calculator") || "calculator",
        assigneeKey: i.isShared
          ? ("shared" as const)
          : fromNote || fromBag || undefined,
      };
    });

    const bags: BagForAssign[] = tripFresh.suitcases.map((s) => ({
      id: s.id,
      name: s.name,
      size: s.size,
      isShared: s.isShared,
      ownerUserId: s.ownerUserId,
    }));

    const currentCounts = new Map<string, number>();
    for (const item of tripFresh.items) {
      if (!item.suitcaseId) continue;
      currentCounts.set(
        item.suitcaseId,
        (currentCounts.get(item.suitcaseId) || 0) + Math.max(1, item.quantity)
      );
    }

    const suitcasePayload = tripFresh.suitcases.map((s) => ({
      id: s.id,
      name: s.name,
      size: s.size,
      isShared: s.isShared,
      ownerUserId: s.ownerUserId,
      ownerName: s.owner?.name || null,
      softMaxItems: softCapacityFor(s.size),
      currentItems: currentCounts.get(s.id) || 0,
    }));

    const enriched = await enrichPackListWithAi({
      legs,
      travelers,
      existing,
      suitcases: suitcasePayload,
    });

    const { suitcaseIdByIndex, fill } = assignNewItems(
      enriched.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        isShared: item.isShared,
        assigneeKey:
          item.assigneeKey === "shared" ? null : item.assigneeKey || null,
        notes: item.notes,
        category: item.category,
        preferredSuitcaseId: item.preferredSuitcaseId || null,
      })),
      bags,
      currentCounts,
      travelers
    );

    for (let idx = 0; idx < enriched.items.length; idx++) {
      const item = enriched.items[idx];
      const owner =
        !item.isShared && item.assigneeKey && item.assigneeKey !== "shared"
          ? travelers.find((t) => t.key === item.assigneeKey)
          : undefined;
      const suitcaseId = suitcaseIdByIndex[idx];

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
      void owner;
    }

    // Rebalance: fill empty suitcase slots; move items out of overloaded bags
    if (rebalance && bags.length) {
      const allItems = await prisma.packItem.findMany({ where: { tripId } });
      const reFill = new Map<string, number>();
      for (const item of allItems) {
        if (item.suitcaseId) {
          reFill.set(
            item.suitcaseId,
            (reFill.get(item.suitcaseId) || 0) + Math.max(1, item.quantity)
          );
        }
      }
      const { warnings } = analyzeCapacity(bags, reFill);
      const overloaded = new Set(warnings.map((w) => w.suitcaseId));
      const travelerNameByKey = new Map(
        travelers.map((t) => [t.key, t.name] as const)
      );

      for (const item of allItems) {
        if (item.packedAt) continue;
        const needsAssign =
          !item.suitcaseId || overloaded.has(item.suitcaseId || "");
        if (!needsAssign) continue;

        // Free slot from old bag before re-pick
        if (item.suitcaseId) {
          reFill.set(
            item.suitcaseId,
            Math.max(
              0,
              (reFill.get(item.suitcaseId) || 0) - Math.max(1, item.quantity)
            )
          );
        }

        const noteMatch = item.notes?.match(/für\s+([^·]+)/i);
        const assigneeKey = item.isShared
          ? null
          : travelers.find(
              (t) =>
                noteMatch &&
                t.name.toLowerCase() === noteMatch[1].trim().toLowerCase()
            )?.key || null;

        const nextId = pickSuitcaseForItem(
          {
            name: item.name,
            quantity: item.quantity,
            isShared: item.isShared,
            assigneeKey,
            notes: item.notes,
            preferredSuitcaseId: null,
          },
          bags,
          reFill,
          travelerNameByKey
        );

        if (nextId && nextId !== item.suitcaseId) {
          await prisma.packItem.update({
            where: { id: item.id },
            data: { suitcaseId: nextId },
          });
        }
      }
    }

    let tips = enriched.tips;
    let guides = enriched.guides;

    if (alsoInsights) {
      const insight = await buildTravelInsights({
        legs,
        travelers,
        title: tripFresh.title,
      });
      if (insight.tips.length) tips = insight.tips;
      if (insight.guides.length) guides = insight.guides;
    }

    if (tips.length || guides.length) {
      const next = mergeInsights(parseAiInsights(tripFresh.aiInsights), {
        tips,
        guides,
      });
      await prisma.trip.update({
        where: { id: tripId },
        data: { aiInsights: stringifyAiInsights(next) },
      });
      void notifyTripMembers(tripId, {
        title: tripFresh.title.slice(0, 50),
        body: "Neue Reisetipps sind bereit.",
        url: `/trip/${tripId}?tab=ai`,
        tag: `tips-${tripId}`,
        motif: "tips",
      });
    }

    const full = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: tripInclude,
    });

    const finalCounts = new Map<string, number>();
    for (const item of full.items) {
      if (!item.suitcaseId) continue;
      finalCounts.set(
        item.suitcaseId,
        (finalCounts.get(item.suitcaseId) || 0) + Math.max(1, item.quantity)
      );
    }
    const capacity = analyzeCapacity(bags, finalCounts);
    const capacityNote =
      enriched.capacityNote || capacity.summary || null;

    publish({ type: "trip_updated", tripId });

    return NextResponse.json({
      ...serializeTrip(full),
      tips,
      guides,
      added: enriched.items.length,
      capacityNote,
      capacityWarnings: capacity.warnings,
      fillAfterAssign: Object.fromEntries(fill),
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
