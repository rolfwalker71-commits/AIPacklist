import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import { publish } from "@/lib/events";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";
import { inviteStatus } from "@/lib/invite";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const sessionUser = await requireSessionUser();
    const { tripId } = await params;
    const body = await req.json();
    const { inviteCode } = body as { inviteCode?: string };
    const profile = body.user as
      | {
          name?: string;
          color?: string;
          gender?: "FEMALE" | "MALE" | "UNSPECIFIED";
          avatarUrl?: string | null;
        }
      | undefined;

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const already = await userCanAccessTrip(sessionUser.id, tripId);

    if (!already) {
      if (!inviteCode || inviteCode.toUpperCase() !== trip.inviteCode) {
        return NextResponse.json(
          { error: "Ungültiger Einladungscode" },
          { status: 403 }
        );
      }
      const status = inviteStatus(trip);
      if (!status.ok) {
        return NextResponse.json(
          { error: status.reason || "Einladung ungültig" },
          { status: 403 }
        );
      }

      await prisma.tripMember.create({
        data: {
          tripId,
          userId: sessionUser.id,
          role: "PARTNER",
        },
      });

      const nextCount = trip.inviteUseCount + 1;
      const exhausted =
        trip.inviteMaxUses != null && nextCount >= trip.inviteMaxUses;
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          inviteUseCount: nextCount,
          ...(exhausted ? { inviteEnabled: false } : {}),
        },
      });

      publish({
        type: "member_joined",
        tripId,
        payload: { userId: sessionUser.id },
      });
    }

    if (profile) {
      await prisma.user.update({
        where: { id: sessionUser.id },
        data: {
          ...(profile.name ? { name: profile.name.trim() } : {}),
          ...(profile.color ? { color: profile.color } : {}),
          ...(profile.gender ? { gender: profile.gender } : {}),
          ...(profile.avatarUrl !== undefined
            ? { avatarUrl: profile.avatarUrl }
            : {}),
        },
      });
    }

    const full = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: tripInclude,
    });

    return NextResponse.json(serializeTrip(full));
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
