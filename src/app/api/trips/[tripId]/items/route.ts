import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publish } from "@/lib/events";
import { inferPriority, normalizePriority } from "@/lib/priority";
import { suggestCategory } from "@/lib/categorize";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";
import { notesWithOwner } from "@/lib/pack-ownership";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const sessionUser = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(sessionUser.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    const body = await req.json();
    const { itemId, packed, suitcaseId } = body as {
      itemId: string;
      packed?: boolean;
      suitcaseId?: string | null;
      ownerUserId?: string | null;
      isShared?: boolean;
    };

    if (!itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const item = await prisma.packItem.findFirst({
      where: { id: itemId, tripId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    let packedByUserId: string | null | undefined = undefined;
    let packedAt: Date | null | undefined = undefined;

    if (typeof packed === "boolean") {
      if (packed) {
        packedByUserId = sessionUser.id;
        packedAt = new Date();
      } else {
        packedByUserId = null;
        packedAt = null;
      }
    }

    let ownerPatch: {
      ownerUserId?: string | null;
      isShared?: boolean;
      notes?: string | null;
    } = {};

    if (body.isShared === true) {
      ownerPatch = {
        isShared: true,
        ownerUserId: null,
        notes: notesWithOwner(item.notes, null),
      };
    } else if (body.ownerUserId !== undefined) {
      const nextOwnerId =
        typeof body.ownerUserId === "string" && body.ownerUserId
          ? body.ownerUserId
          : null;
      if (nextOwnerId) {
        const member = await prisma.tripMember.findUnique({
          where: { tripId_userId: { tripId, userId: nextOwnerId } },
          include: { user: true },
        });
        if (!member) {
          return NextResponse.json(
            { error: "Zuweisung ungültig" },
            { status: 400 }
          );
        }
        ownerPatch = {
          isShared: false,
          ownerUserId: nextOwnerId,
          notes: notesWithOwner(item.notes, member.user.name),
        };
      } else {
        ownerPatch = {
          isShared: false,
          ownerUserId: null,
          notes: notesWithOwner(item.notes, null),
        };
      }
    }

    const updated = await prisma.packItem.update({
      where: { id: itemId },
      data: {
        ...(packedByUserId !== undefined ? { packedByUserId, packedAt } : {}),
        ...(suitcaseId !== undefined ? { suitcaseId } : {}),
        ...ownerPatch,
      },
      include: { packedBy: true, suitcase: true, owner: true },
    });

    publish({
      type: "item_updated",
      tripId,
      itemId,
      payload: {
        ...updated,
        packedAt: updated.packedAt?.toISOString() ?? null,
      },
    });

    if (typeof packed === "boolean") {
      void import("@/lib/push-milestones").then((m) =>
        m.maybeNotifyPackMilestones(tripId)
      );
    }

    return NextResponse.json({
      ...updated,
      packedAt: updated.packedAt?.toISOString() ?? null,
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
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

    const body = await req.json();
    const name = String(body.name || "").trim().slice(0, 80);
    if (!name) {
      return NextResponse.json({ error: "Name nötig" }, { status: 400 });
    }

    const extraNotes = body.notes ? String(body.notes).trim().slice(0, 200) : "";
    const quantity = Math.max(1, Math.min(99, Number(body.quantity) || 1));

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: { include: { user: true } } },
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const assigneeUserId =
      typeof body.assigneeUserId === "string" && body.assigneeUserId
        ? body.assigneeUserId
        : null;

    let shared = false;
    let ownerUserId: string | null = null;
    let assigneeName: string | null = null;

    if (body.assignee === "shared" || body.isShared === true) {
      shared = true;
    } else if (assigneeUserId) {
      const member = trip.members.find((m) => m.userId === assigneeUserId);
      if (!member) {
        return NextResponse.json(
          { error: "Zuweisung ungültig" },
          { status: 400 }
        );
      }
      ownerUserId = member.userId;
      assigneeName = member.user.name;
    } else if (trip.members.length === 1) {
      ownerUserId = trip.members[0].userId;
      assigneeName = trip.members[0].user.name;
    }

    const notes = notesWithOwner(extraNotes || null, shared ? null : assigneeName);

    const categoryRaw =
      typeof body.category === "string" ? body.category.trim() : "";
    const category =
      !categoryRaw ||
      categoryRaw === "auto" ||
      body.categoryMode === "auto"
        ? suggestCategory(name, notes)
        : categoryRaw.slice(0, 40);

    const fromBody = normalizePriority(body.priority);
    const priority =
      body.priority != null && fromBody !== "NORMAL"
        ? fromBody
        : inferPriority(name, category, notes);

    const item = await prisma.packItem.create({
      data: {
        tripId,
        name,
        category,
        quantity,
        isShared: shared,
        ownerUserId,
        priority,
        suitcaseId: null,
        notes,
        source: "manual",
      },
      include: { packedBy: true, suitcase: true, owner: true },
    });

    publish({
      type: "item_updated",
      tripId,
      itemId: item.id,
      payload: { ...item, packedAt: null, created: true },
    });

    return NextResponse.json({
      ...item,
      packedAt: null,
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const sessionUser = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(sessionUser.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const itemId =
      (body as { itemId?: string }).itemId ||
      req.nextUrl.searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const item = await prisma.packItem.findFirst({
      where: { id: itemId, tripId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.packItem.delete({ where: { id: itemId } });

    publish({
      type: "item_updated",
      tripId,
      itemId,
      payload: { deleted: true },
    });

    return NextResponse.json({ ok: true, itemId });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
