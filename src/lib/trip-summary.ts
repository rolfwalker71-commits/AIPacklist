import { prisma } from "@/lib/db";
import { tripsForUserWhere } from "@/lib/trip-access";

export type TripSummary = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  inviteCode: string;
  ownerId: string;
  updatedAt: string;
  legCount: number;
  itemCount: number;
  packedCount: number;
  memberCount: number;
  members: { id: string; name: string; color: string; avatarUrl: string | null }[];
  transports: string[];
  hasGala: boolean;
};

/**
 * Trips for the home screen, including the packed/total split so a card
 * can show progress without loading every item into the page payload.
 */
export async function loadTripSummaries(
  userId: string,
  take = 40
): Promise<TripSummary[]> {
  const trips = await prisma.trip.findMany({
    where: tripsForUserWhere(userId),
    orderBy: { startDate: "desc" },
    take,
    include: {
      _count: { select: { items: true, members: true, legs: true } },
      members: { include: { user: true } },
      legs: { select: { transport: true, dressCodes: true } },
    },
  });

  if (trips.length === 0) return [];

  const packed = await prisma.packItem.groupBy({
    by: ["tripId"],
    where: { tripId: { in: trips.map((t) => t.id) }, packedAt: { not: null } },
    _count: { _all: true },
  });
  const packedByTrip = new Map(packed.map((p) => [p.tripId, p._count._all]));

  return trips.map((trip) => ({
    id: trip.id,
    title: trip.title,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    inviteCode: trip.inviteCode,
    ownerId: trip.ownerId,
    updatedAt: trip.updatedAt.toISOString(),
    legCount: trip._count.legs,
    itemCount: trip._count.items,
    packedCount: packedByTrip.get(trip.id) ?? 0,
    memberCount: trip._count.members,
    members: trip.members.slice(0, 4).map((m) => ({
      id: m.user.id,
      name: m.user.name,
      color: m.user.color,
      avatarUrl: m.user.avatarUrl,
    })),
    transports: [...new Set(trips.length ? trip.legs.map((l) => l.transport) : [])],
    hasGala: trip.legs.some((l) => l.dressCodes.includes("GALA")),
  }));
}
