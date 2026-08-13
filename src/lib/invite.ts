import { addDays } from "date-fns";
import { generateInviteCode } from "@/lib/utils";
import { prisma } from "@/lib/db";

export const DEFAULT_INVITE_DAYS = 30;

export type InviteTripFields = {
  inviteCode: string;
  inviteEnabled: boolean;
  inviteExpiresAt: Date | null;
  inviteMaxUses: number | null;
  inviteUseCount: number;
};

export function defaultInviteExpiry(from = new Date()): Date {
  return addDays(from, DEFAULT_INVITE_DAYS);
}

export async function allocateInviteCode(): Promise<string> {
  let inviteCode = generateInviteCode();
  while (await prisma.trip.findUnique({ where: { inviteCode } })) {
    inviteCode = generateInviteCode();
  }
  return inviteCode;
}

export function inviteStatus(trip: InviteTripFields): {
  ok: boolean;
  reason?: string;
} {
  if (!trip.inviteEnabled) {
    return { ok: false, reason: "Einladung ist deaktiviert." };
  }
  if (trip.inviteExpiresAt && trip.inviteExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "Einladungscode ist abgelaufen." };
  }
  if (
    trip.inviteMaxUses != null &&
    trip.inviteUseCount >= trip.inviteMaxUses
  ) {
    return {
      ok: false,
      reason: "Einladungscode wurde bereits aufgebraucht.",
    };
  }
  return { ok: true };
}

export function serializeInvite(trip: InviteTripFields) {
  const status = inviteStatus(trip);
  return {
    inviteCode: trip.inviteCode,
    inviteEnabled: trip.inviteEnabled,
    inviteExpiresAt: trip.inviteExpiresAt?.toISOString() ?? null,
    inviteMaxUses: trip.inviteMaxUses,
    inviteUseCount: trip.inviteUseCount,
    inviteValid: status.ok,
    inviteInvalidReason: status.reason ?? null,
  };
}
