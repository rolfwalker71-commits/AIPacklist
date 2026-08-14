import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import {
  allocateRouteShareCode,
  defaultRouteShareExpiry,
  serializeRouteShare,
} from "@/lib/route-share";

/**
 * Owner/admin: enable or refresh a route-only share code.
 * Body: { regenerate?: boolean, enabled?: boolean, extendDays?: boolean, singleUse?: boolean }
 */
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

    const isOwner = trip.ownerId === user.id || user.role === "ADMIN";
    if (!isOwner) {
      return NextResponse.json(
        { error: "Nur die Trip-Besitzer:in kann die Route teilen." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const regenerate = Boolean((body as { regenerate?: boolean }).regenerate);
    const singleUse = Boolean((body as { singleUse?: boolean }).singleUse);
    const extendDays = Boolean((body as { extendDays?: boolean }).extendDays);
    const enabled =
      typeof (body as { enabled?: boolean }).enabled === "boolean"
        ? (body as { enabled: boolean }).enabled
        : undefined;

    const data: {
      routeShareCode?: string;
      routeShareEnabled?: boolean;
      routeShareExpiresAt?: Date | null;
      routeShareMaxUses?: number | null;
      routeShareUseCount?: number;
    } = {};

    if (regenerate || !trip.routeShareCode) {
      data.routeShareCode = await allocateRouteShareCode();
      data.routeShareEnabled = true;
      data.routeShareExpiresAt = defaultRouteShareExpiry();
      data.routeShareUseCount = 0;
      data.routeShareMaxUses = singleUse ? 1 : null;
    } else {
      if (enabled !== undefined) data.routeShareEnabled = enabled;
      if (extendDays) {
        data.routeShareExpiresAt = defaultRouteShareExpiry();
        data.routeShareEnabled = true;
      }
      if (singleUse) {
        data.routeShareMaxUses = 1;
        data.routeShareUseCount = 0;
        data.routeShareEnabled = true;
      }
    }

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data,
    });

    const full = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: tripInclude,
    });

    return NextResponse.json({
      ...serializeTrip(full),
      ...serializeRouteShare(updated),
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
