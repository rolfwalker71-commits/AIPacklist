import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";
import { publish } from "@/lib/events";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import {
  buildMergePlans,
  countDuplicateLosers,
  findDuplicateGroups,
  type CleanupItem,
} from "@/lib/pack-cleanup";
import type { PackPriority } from "@/lib/priority";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

function toCleanupItems(
  items: {
    id: string;
    name: string;
    quantity: number;
    isShared: boolean;
    notes: string | null;
    priority: string;
    packedAt: Date | null;
    packedByUserId: string | null;
    photoUrl: string | null;
    suitcaseId: string | null;
    suitcase?: { isShared: boolean; ownerUserId: string | null } | null;
  }[],
  members: { userId: string; user: { id: string; name: string } }[]
): CleanupItem[] {
  return items.map((i) => {
    const noteMatch = i.notes?.match(/für\s+([^·]+)/i);
    const fromNote = noteMatch
      ? members.find(
          (m) =>
            m.user.name.toLowerCase() === noteMatch[1].trim().toLowerCase()
        )?.userId
      : null;
    const fromBag =
      i.suitcase && !i.suitcase.isShared && i.suitcase.ownerUserId
        ? i.suitcase.ownerUserId
        : null;
    return {
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      isShared: i.isShared,
      notes: i.notes,
      priority: i.priority as PackPriority,
      packedAt: i.packedAt,
      photoUrl: i.photoUrl,
      packedByUserId: i.packedByUserId,
      assigneeKey: i.isShared
        ? "shared"
        : fromNote || fromBag || undefined,
    };
  });
}

function removeLoserPhotos(loserIds: string[]) {
  const dir = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "item-photos"
  );
  for (const id of loserIds) {
    for (const ext of ["jpg", "png", "webp"]) {
      const p = path.join(dir, `${id}.${ext}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
}

/** Preview duplicate groups without merging. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(user.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        items: { include: { suitcase: true } },
        members: { include: { user: true } },
      },
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const cleanupItems = toCleanupItems(trip.items, trip.members);
    const groups = findDuplicateGroups(cleanupItems);
    return NextResponse.json({
      groups: groups.map((g) => ({
        names: g.names,
        survivorId: g.survivorId,
        loserCount: g.loserIds.length,
      })),
      groupCount: groups.length,
      removedCount: countDuplicateLosers(groups),
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

/** Merge semantic duplicates on the trip pack list. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(user.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        items: { include: { suitcase: true } },
        members: { include: { user: true } },
      },
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const cleanupItems = toCleanupItems(trip.items, trip.members);
    const groups = findDuplicateGroups(cleanupItems);
    if (!groups.length) {
      const full = await prisma.trip.findUniqueOrThrow({
        where: { id: tripId },
        include: tripInclude,
      });
      return NextResponse.json({
        ...serializeTrip(full),
        mergedGroups: 0,
        removedCount: 0,
        message: "Keine Duplikate gefunden.",
      });
    }

    const plans = buildMergePlans(cleanupItems, groups);
    const allLosers = plans.flatMap((p) => p.loserIds);

    await prisma.$transaction(async (tx) => {
      for (const plan of plans) {
        await tx.packItem.update({
          where: { id: plan.survivorId },
          data: {
            quantity: plan.quantity,
            priority: plan.priority,
            notes: plan.notes,
            photoUrl: plan.photoUrl,
            packedAt: plan.packedAt,
            packedByUserId: plan.packedByUserId,
          },
        });
      }
      if (allLosers.length) {
        await tx.packItem.deleteMany({
          where: { id: { in: allLosers }, tripId },
        });
      }
    });

    removeLoserPhotos(allLosers);
    publish({ type: "trip_updated", tripId });

    const full = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: tripInclude,
    });

    return NextResponse.json({
      ...serializeTrip(full),
      mergedGroups: plans.length,
      removedCount: allLosers.length,
      message: `${allLosers.length} Doppelte in ${plans.length} Gruppe(n) zusammengeführt.`,
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
