import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureUser, serializeTrip, tripInclude } from "@/lib/trip-service";
import { publish } from "@/lib/events";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const body = await req.json();
  const { inviteCode, user } = body as {
    inviteCode?: string;
    user: {
      id?: string;
      name: string;
      color?: string;
      gender?: "FEMALE" | "MALE" | "UNSPECIFIED";
      avatarUrl?: string | null;
    };
  };

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (inviteCode && inviteCode.toUpperCase() !== trip.inviteCode) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
  }

  const memberUser = await ensureUser(user);
  const existing = await prisma.tripMember.findUnique({
    where: {
      tripId_userId: { tripId, userId: memberUser.id },
    },
  });

  if (!existing) {
    await prisma.tripMember.create({
      data: { tripId, userId: memberUser.id, role: "PARTNER" },
    });
  }

  const full = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: tripInclude,
  });

  publish({
    type: "member_joined",
    tripId,
    payload: { user: memberUser },
  });

  return NextResponse.json(serializeTrip(full));
}
