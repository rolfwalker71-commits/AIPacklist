import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  authErrorResponse,
  requireSessionUser,
} from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";
import {
  allocateInviteCode,
  defaultInviteExpiry,
  DEFAULT_INVITE_DAYS,
} from "@/lib/invite";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import { publish } from "@/lib/events";
import { addDays } from "date-fns";

/** Owner-only: regenerate / enable / disable / set one-time / extend expiry. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(user.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (trip.ownerId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Nur die Trip-Besitzer:in kann die Einladung ändern." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const data: {
      inviteCode?: string;
      inviteEnabled?: boolean;
      inviteExpiresAt?: Date | null;
      inviteMaxUses?: number | null;
      inviteUseCount?: number;
    } = {};

    if (body.regenerate === true) {
      data.inviteCode = await allocateInviteCode();
      data.inviteUseCount = 0;
      data.inviteEnabled = true;
      data.inviteExpiresAt = defaultInviteExpiry();
      if (body.singleUse === true) {
        data.inviteMaxUses = 1;
      } else if (body.singleUse === false) {
        data.inviteMaxUses = null;
      }
    }

    if (typeof body.inviteEnabled === "boolean") {
      data.inviteEnabled = body.inviteEnabled;
    }

    if (body.singleUse === true && body.regenerate !== true) {
      data.inviteMaxUses = 1;
    }
    if (body.singleUse === false && body.regenerate !== true) {
      data.inviteMaxUses = null;
    }

    if (body.extendDays === true) {
      const base =
        trip.inviteExpiresAt && trip.inviteExpiresAt.getTime() > Date.now()
          ? trip.inviteExpiresAt
          : new Date();
      data.inviteExpiresAt = addDays(base, DEFAULT_INVITE_DAYS);
      data.inviteEnabled = true;
    }

    if (typeof body.expireInDays === "number" && body.expireInDays > 0) {
      data.inviteExpiresAt = addDays(new Date(), Math.min(365, body.expireInDays));
      data.inviteEnabled = true;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
    }

    await prisma.trip.update({ where: { id: tripId }, data });

    const full = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: tripInclude,
    });
    publish({ type: "trip_updated", tripId });
    return NextResponse.json(serializeTrip(full));
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
