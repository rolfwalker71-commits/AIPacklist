import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publish } from "@/lib/events";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import type { SuitcaseSize } from "@/lib/suitcases";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const body = await req.json();
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.suitcase.create({
    data: {
      tripId,
      name: body.name || "Neuer Koffer",
      size: (body.size as SuitcaseSize) || "MEDIUM",
      isShared: Boolean(body.isShared),
      ownerUserId: body.ownerUserId || trip.ownerId,
    },
  });

  const full = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: tripInclude,
  });
  publish({ type: "trip_updated", tripId });
  return NextResponse.json(serializeTrip(full));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const body = await req.json();
  if (!body.suitcaseId) {
    return NextResponse.json({ error: "suitcaseId required" }, { status: 400 });
  }

  const existing = await prisma.suitcase.findFirst({
    where: { id: body.suitcaseId, tripId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.suitcase.update({
    where: { id: body.suitcaseId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.size !== undefined ? { size: body.size as SuitcaseSize } : {}),
      ...(body.isShared !== undefined ? { isShared: Boolean(body.isShared) } : {}),
      ...(body.ownerUserId !== undefined
        ? { ownerUserId: body.ownerUserId }
        : {}),
    },
  });

  const full = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: tripInclude,
  });
  publish({ type: "trip_updated", tripId });
  return NextResponse.json(serializeTrip(full));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const suitcaseId = req.nextUrl.searchParams.get("suitcaseId");
  if (!suitcaseId) {
    return NextResponse.json({ error: "suitcaseId required" }, { status: 400 });
  }

  const count = await prisma.suitcase.count({ where: { tripId } });
  if (count <= 1) {
    return NextResponse.json(
      { error: "Mindestens ein Koffer muss bleiben" },
      { status: 400 }
    );
  }

  await prisma.packItem.updateMany({
    where: { tripId, suitcaseId },
    data: { suitcaseId: null },
  });
  await prisma.suitcase.delete({ where: { id: suitcaseId } });

  const full = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: tripInclude,
  });
  publish({ type: "trip_updated", tripId });
  return NextResponse.json(serializeTrip(full));
}
