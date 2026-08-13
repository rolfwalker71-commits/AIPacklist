import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publish } from "@/lib/events";
import { ensureUser } from "@/lib/trip-service";
import { inferPriority, normalizePriority } from "@/lib/priority";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const body = await req.json();
  const { itemId, packed, userId, userName, userColor, suitcaseId } = body as {
    itemId: string;
    packed?: boolean;
    userId?: string;
    userName?: string;
    userColor?: string;
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
      const user = await ensureUser({
        id: userId,
        name: userName || "Reisende:r",
        color: userColor,
      });
      packedByUserId = user.id;
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
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const body = await req.json();
  const name = String(body.name || "").slice(0, 80);
  const category = String(body.category || "Sonstiges").slice(0, 40);
  const notes = body.notes ? String(body.notes) : null;
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
      quantity: body.quantity || 1,
      isShared: Boolean(body.isShared),
      priority,
      suitcaseId: body.suitcaseId || null,
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

  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
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
}
