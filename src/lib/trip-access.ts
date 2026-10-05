import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export async function userCanAccessTrip(
  userId: string,
  tripId: string
): Promise<boolean> {
  const membership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });
  if (membership) return true;
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { ownerId: true },
  });
  return trip?.ownerId === userId;
}

export async function requireTripAccess(user: SessionUser, tripId: string) {
  const ok = await userCanAccessTrip(user.id, tripId);
  if (!ok) {
    const err = new Error("Kein Zugang zu dieser Reise") as Error & {
      status: number;
    };
    err.status = 403;
    throw err;
  }
}

export function tripsForUserWhere(userId: string) {
  return {
    OR: [{ ownerId: userId }, { members: { some: { userId } } }],
  };
}

/** Route guard: signed-in user with access to the trip, or a ready error response. */
export async function guardTrip(
  tripId: string
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 }),
    };
  }
  if (!(await userCanAccessTrip(user.id, tripId))) {
    return {
      response: NextResponse.json(
        { error: "Kein Zugang zu dieser Reise" },
        { status: 403 }
      ),
    };
  }
  return { user };
}
