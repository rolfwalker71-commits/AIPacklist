import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publish } from "@/lib/events";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import type { Transport } from "@prisma/client";
import { scheduleRoutePush } from "@/lib/push";
import { requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  let actorName: string | undefined;
  try {
    const user = await requireSessionUser();
    if (!(await userCanAccessTrip(user.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }
    actorName = user.name;
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await req.json();
  const legId = String(body.legId || "");
  if (!legId) {
    return NextResponse.json({ error: "legId nötig" }, { status: 400 });
  }

  const existing = await prisma.leg.findFirst({
    where: { id: legId, tripId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Etappe nicht gefunden" }, { status: 404 });
  }

  const data: {
    name?: string;
    location?: string | null;
    startDate?: Date;
    endDate?: Date;
    transport?: Transport;
    laundryAvailable?: boolean;
    laundryIntervalDays?: number | null;
    weatherTags?: string;
    dressCodes?: string;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim().slice(0, 80);
  }
  if (body.location !== undefined) {
    data.location =
      typeof body.location === "string" && body.location.trim()
        ? body.location.trim().slice(0, 80)
        : null;
  }
  if (typeof body.startDate === "string") {
    data.startDate = new Date(body.startDate);
  }
  if (typeof body.endDate === "string") {
    data.endDate = new Date(body.endDate);
  }
  if (typeof body.transport === "string") {
    data.transport = body.transport as Transport;
  }
  if (typeof body.laundryAvailable === "boolean") {
    data.laundryAvailable = body.laundryAvailable;
  }
  if (body.laundryIntervalDays !== undefined) {
    data.laundryIntervalDays =
      body.laundryIntervalDays == null
        ? null
        : Number(body.laundryIntervalDays) || null;
  }
  if (Array.isArray(body.weatherTags)) {
    data.weatherTags = JSON.stringify(body.weatherTags);
  }
  if (Array.isArray(body.dressCodes)) {
    data.dressCodes = JSON.stringify(body.dressCodes);
  }

  await prisma.leg.update({ where: { id: legId }, data });

  // Keep trip date range in sync with legs
  const legs = await prisma.leg.findMany({
    where: { tripId },
    orderBy: { sortOrder: "asc" },
  });
  if (legs.length) {
    const starts = legs.map((l) => l.startDate.getTime());
    const ends = legs.map((l) => l.endDate.getTime());
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        startDate: new Date(Math.min(...starts)),
        endDate: new Date(Math.max(...ends)),
      },
    });
  }

  const full = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: tripInclude,
  });
  publish({ type: "trip_updated", tripId });
  scheduleRoutePush(tripId, full.title, actorName);
  return NextResponse.json(serializeTrip(full));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  let actorName: string | undefined;
  try {
    const user = await requireSessionUser();
    if (!(await userCanAccessTrip(user.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }
    actorName = user.name;
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const legId =
    (body as { legId?: string }).legId ||
    req.nextUrl.searchParams.get("legId");
  if (!legId) {
    return NextResponse.json({ error: "legId nötig" }, { status: 400 });
  }

  const count = await prisma.leg.count({ where: { tripId } });
  if (count <= 1) {
    return NextResponse.json(
      { error: "Mindestens eine Etappe muss bleiben." },
      { status: 400 }
    );
  }

  const existing = await prisma.leg.findFirst({
    where: { id: legId, tripId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Etappe nicht gefunden" }, { status: 404 });
  }

  await prisma.leg.delete({ where: { id: legId } });

  const legs = await prisma.leg.findMany({
    where: { tripId },
    orderBy: { sortOrder: "asc" },
  });
  if (legs.length) {
    const starts = legs.map((l) => l.startDate.getTime());
    const ends = legs.map((l) => l.endDate.getTime());
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        startDate: new Date(Math.min(...starts)),
        endDate: new Date(Math.max(...ends)),
      },
    });
  }

  const full = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: tripInclude,
  });
  publish({ type: "trip_updated", tripId });
  scheduleRoutePush(tripId, full.title, actorName);
  return NextResponse.json(serializeTrip(full));
}
