import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";
import { publish } from "@/lib/events";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import { notesWithOwner } from "@/lib/pack-ownership";
import {
  expandApplyLines,
  reviewPackWithAgent,
  type AgentChatTurn,
  type AgentScope,
  type ApplyLine,
} from "@/lib/pack-agent";
import type { PackGender, Transport, TravelerProfile } from "@/lib/types";
import { pickSuitcaseForItem } from "@/lib/suitcase-capacity";

function tripTravelers(
  members: { userId: string; user: { name: string; gender: string | null } }[]
): TravelerProfile[] {
  return members.map((m) => ({
    key: m.userId,
    name: m.user.name,
    gender: (m.user.gender as PackGender) || "UNSPECIFIED",
  }));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const sessionUser = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(sessionUser.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      message?: string;
      history?: AgentChatTurn[];
      proposals?: ApplyLine[];
    };

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: tripInclude,
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const travelers = tripTravelers(trip.members);
    const legs = trip.legs.map((leg) => ({
      name: leg.name,
      location: (leg as { location?: string | null }).location || null,
      startDate: leg.startDate.toISOString().slice(0, 10),
      endDate: leg.endDate.toISOString().slice(0, 10),
      transport: leg.transport as Transport,
      laundryAvailable: leg.laundryAvailable,
      laundryIntervalDays: (leg as { laundryIntervalDays?: number | null })
        .laundryIntervalDays,
      weatherTags: JSON.parse(leg.weatherTags) as never[],
      dressCodes: JSON.parse(leg.dressCodes) as never[],
    }));

    if (body.action === "apply") {
      const incoming = Array.isArray(body.proposals) ? body.proposals : [];
      if (!incoming.length) {
        return NextResponse.json(
          { error: "Keine bestätigten Vorschläge" },
          { status: 400 }
        );
      }

      const bags = trip.suitcases.map((s) => ({
        id: s.id,
        name: s.name,
        size: s.size,
        isShared: s.isShared,
        ownerUserId: s.ownerUserId,
      }));
      const fill = new Map<string, number>();
      for (const item of trip.items) {
        if (!item.suitcaseId) continue;
        fill.set(
          item.suitcaseId,
          (fill.get(item.suitcaseId) || 0) + Math.max(1, item.quantity)
        );
      }
      const travelerNameByKey = new Map(travelers.map((t) => [t.key, t.name]));

      let added = 0;
      for (const line of incoming.slice(0, 16)) {
        const name = String(line.name || "").trim();
        if (!name) continue;
        const scope = (
          line.scope === "person" || line.scope === "both" || line.scope === "shared"
            ? line.scope
            : "shared"
        ) as AgentScope;

        const expanded = expandApplyLines(
          {
            name,
            category: line.category,
            quantity: line.quantity,
            priority: line.priority,
            notes: line.notes,
            scope,
            ownerUserId: line.ownerUserId || null,
          },
          travelers
        );

        for (const row of expanded) {
          const owner = row.ownerUserId
            ? travelers.find((t) => t.key === row.ownerUserId)
            : undefined;
          const suitcaseId = bags.length
            ? pickSuitcaseForItem(
                {
                  name: row.name,
                  quantity: row.quantity,
                  isShared: row.isShared,
                  assigneeKey: row.isShared ? null : row.ownerUserId,
                  notes: row.notes,
                },
                bags,
                fill,
                travelerNameByKey
              )
            : null;
          if (suitcaseId) {
            fill.set(
              suitcaseId,
              (fill.get(suitcaseId) || 0) + Math.max(1, row.quantity)
            );
          }

          await prisma.packItem.create({
            data: {
              tripId,
              name: row.name,
              category: row.category,
              quantity: row.quantity,
              isShared: row.isShared,
              priority: row.priority,
              notes: notesWithOwner(
                row.notes,
                row.isShared ? null : owner?.name || null
              ),
              source: "ai",
              suitcaseId,
              ownerUserId: row.ownerUserId,
            },
          });
          added += 1;
        }
      }

      const full = await prisma.trip.findUniqueOrThrow({
        where: { id: tripId },
        include: tripInclude,
      });
      publish({ type: "trip_updated", tripId });
      return NextResponse.json({
        ...serializeTrip(full),
        added,
        reply:
          added === 0
            ? "Nichts übernommen."
            : added === 1
              ? "1 Position ist auf der Liste."
              : `${added} Positionen sind auf der Liste.`,
      });
    }

    const review = await reviewPackWithAgent({
      title: trip.title,
      legs,
      travelers,
      existing: trip.items.map((i) => ({
        name: i.name,
        category: i.category,
        isShared: i.isShared,
        notes: i.notes,
        ownerUserId: i.ownerUserId,
        assigneeKey: i.isShared ? "shared" : i.ownerUserId || undefined,
      })),
      message: body.message,
      history: Array.isArray(body.history) ? body.history.slice(-8) : [],
    });

    return NextResponse.json(review);
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    if (status !== 500) {
      return NextResponse.json({ error }, { status });
    }
    console.error("pack agent failed", e);
    const message =
      e instanceof Error ? e.message : "Pack-Agent fehlgeschlagen";
    return NextResponse.json({ error: message.slice(0, 280) }, { status: 500 });
  }
}
