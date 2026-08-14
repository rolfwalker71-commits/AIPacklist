import { addDays } from "date-fns";
import { generateInviteCode } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { DEFAULT_INVITE_DAYS } from "@/lib/invite";

export type RouteShareFields = {
  routeShareCode: string | null;
  routeShareEnabled: boolean;
  routeShareExpiresAt: Date | null;
  routeShareMaxUses: number | null;
  routeShareUseCount: number;
};

export function defaultRouteShareExpiry(from = new Date()): Date {
  return addDays(from, DEFAULT_INVITE_DAYS);
}

/** Code unique across packing invites and route shares. */
export async function allocateRouteShareCode(): Promise<string> {
  let code = generateInviteCode();
  for (;;) {
    const clash = await prisma.trip.findFirst({
      where: {
        OR: [{ inviteCode: code }, { routeShareCode: code }],
      },
      select: { id: true },
    });
    if (!clash) return code;
    code = generateInviteCode();
  }
}

export function routeShareStatus(trip: RouteShareFields): {
  ok: boolean;
  reason?: string;
} {
  if (!trip.routeShareCode) {
    return { ok: false, reason: "Noch kein Route-Code erzeugt." };
  }
  if (!trip.routeShareEnabled) {
    return { ok: false, reason: "Route-Teilen ist pausiert." };
  }
  if (
    trip.routeShareExpiresAt &&
    trip.routeShareExpiresAt.getTime() < Date.now()
  ) {
    return { ok: false, reason: "Route-Code ist abgelaufen." };
  }
  if (
    trip.routeShareMaxUses != null &&
    trip.routeShareUseCount >= trip.routeShareMaxUses
  ) {
    return {
      ok: false,
      reason: "Route-Code wurde bereits aufgebraucht.",
    };
  }
  return { ok: true };
}

export function serializeRouteShare(trip: RouteShareFields) {
  const status = routeShareStatus(trip);
  return {
    routeShareCode: trip.routeShareCode,
    routeShareEnabled: trip.routeShareEnabled,
    routeShareExpiresAt: trip.routeShareExpiresAt?.toISOString() ?? null,
    routeShareMaxUses: trip.routeShareMaxUses,
    routeShareUseCount: trip.routeShareUseCount,
    routeShareValid: status.ok,
    routeShareInvalidReason: status.reason ?? null,
  };
}
