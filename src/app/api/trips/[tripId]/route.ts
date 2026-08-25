import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeTrip, tripInclude, backfillItemOwners } from "@/lib/trip-service";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";

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
    await backfillItemOwners(tripId);
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: tripInclude,
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializeTrip(trip));
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { tripId } = await params;
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, ownerId: true },
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = trip.ownerId === user.id || user.role === "ADMIN";
    if (isOwner) {
      await prisma.trip.delete({ where: { id: tripId } });
      return NextResponse.json({ ok: true, action: "deleted" });
    }

    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: user.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    await prisma.tripMember.delete({
      where: { tripId_userId: { tripId, userId: user.id } },
    });
    return NextResponse.json({ ok: true, action: "left" });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
