import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publish } from "@/lib/events";
import { inferPriority, normalizePriority } from "@/lib/priority";
import { suggestCategory } from "@/lib/categorize";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";

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

    const updated = await prisma.packItem.update({
      where: { id: itemId },
      data: {
        ...(packedByUserId !== undefined ? { packedByUserId, packedAt } : {}),
        ...(suitcaseId !== undefined ? { suitcaseId } : {}),
      },
      include: { packedBy: true, suitcase: true },
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
      assigneeName = member.user.name;
    } else if (trip.members.length === 1) {
      assigneeName = trip.members[0].user.name;
    } else {
      assigneeName =
        trip.members.find((m) => m.userId === sessionUser.id)?.user.name ||
        sessionUser.name;
    }

    const noteParts = [
      assigneeName && !shared ? `für ${assigneeName}` : null,
      extraNotes || null,
    ].filter(Boolean);
    const notes = noteParts.length ? noteParts.join(" · ") : null;

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
        priority,
        suitcaseId: null,
        notes,
        source: "manual",
      },
      include: { packedBy: true, suitcase: true },
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
