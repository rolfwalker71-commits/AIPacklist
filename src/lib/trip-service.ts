import { prisma } from "./db";
import { buildPackList } from "./ai-pack";
import {
  daysWithoutLaundry,
  personalItemsForTraveler,
} from "./calculator";
import { stringifyAiInsights, parseAiInsights } from "./ai-insights";
import {
  allocateInviteCode,
  defaultInviteExpiry,
  serializeInvite,
} from "./invite";
import {
  routeShareStatus,
  serializeRouteShare,
} from "./route-share";
import { inferPriority } from "./priority";
import { USER_COLORS } from "./utils";
import type { DressCode, PackGender, TripDraft, WeatherTag } from "./types";
import type { SuitcasePlan, SuitcaseSize } from "./suitcases";
import { formatISO, startOfDay } from "date-fns";

export type UserInput = {
  id?: string;
  name: string;
  color?: string;
  gender?: PackGender;
  avatarUrl?: string | null;
};

export async function ensureUser(input: UserInput) {
  const gender = input.gender ?? "UNSPECIFIED";
  if (input.id) {
    const existing = await prisma.user.findUnique({ where: { id: input.id } });
    if (existing) {
      return prisma.user.update({
        where: { id: input.id },
        data: {
          name: input.name,
          color: input.color ?? existing.color,
          gender: input.gender ?? existing.gender,
          ...(input.avatarUrl !== undefined
            ? { avatarUrl: input.avatarUrl }
            : {}),
        },
      });
    }
  }

  return prisma.user.create({
    data: {
      id: input.id,
      name: input.name,
      color: input.color ?? USER_COLORS[0],
      gender,
      avatarUrl: input.avatarUrl || null,
    },
  });
}

function defaultPlans(
  ownerName: string,
  partnerName?: string
): SuitcasePlan[] {
  const plans: SuitcasePlan[] = [
    {
      id: "auto-1",
      name: `Koffer 1 (${ownerName})`,
      size: "MEDIUM",
      ownerRole: "owner",
    },
  ];
  if (partnerName) {
    plans.push({
      id: "auto-2",
      name: `Koffer 2 (${partnerName})`,
      size: "MEDIUM",
      ownerRole: "partner",
    });
  }
  plans.push({
    id: "auto-shared",
    name: "Handgepäck / Gemeinsam",
    size: "CABIN",
    ownerRole: "shared",
  });
  return plans;
}

export async function createTripFromDraft(
  draft: TripDraft,
  owner: UserInput,
  partner?: UserInput,
  suitcasePlans?: SuitcasePlan[]
) {
  const user = await ensureUser(owner);
  const inviteCode = await allocateInviteCode();

  const travelers = [
    {
      key: user.id,
      name: user.name,
      gender: (user.gender as PackGender) || "UNSPECIFIED",
    },
    ...(partner?.name
      ? [
          {
            key: "partner-pending",
            name: partner.name,
            gender: partner.gender || ("UNSPECIFIED" as PackGender),
          },
        ]
      : []),
  ];

  const { items, tips, guides } = await buildPackList({
    legs: draft.legs,
    travelers,
  });
  const plans =
    suitcasePlans && suitcasePlans.length > 0
      ? suitcasePlans
      : defaultPlans(user.name, partner?.name);

  let partnerUserId: string | undefined;
  let partnerUser = null as Awaited<ReturnType<typeof ensureUser>> | null;
  if (partner?.name) {
    partnerUser = await ensureUser({
      name: partner.name,
      color: partner.color ?? USER_COLORS[1],
      gender: partner.gender,
    });
    partnerUserId = partnerUser.id;
  }

  const trip = await prisma.trip.create({
    data: {
      title: draft.title,
      startDate: new Date(draft.startDate),
      endDate: new Date(draft.endDate),
      inviteCode,
      inviteEnabled: true,
      inviteExpiresAt: defaultInviteExpiry(),
      inviteMaxUses: null,
      inviteUseCount: 0,
      ownerId: user.id,
      aiInsights: stringifyAiInsights({
        tips,
        guides,
        updatedAt: new Date().toISOString(),
      }),
      members: {
        create: [
          { userId: user.id, role: "OWNER" },
          ...(partnerUser
            ? [{ userId: partnerUser.id, role: "PARTNER" as const }]
            : []),
        ],
      },
      legs: {
        create: draft.legs.map((leg, idx) => ({
          name: leg.name,
          location: leg.location?.trim() || null,
          startDate: new Date(leg.startDate),
          endDate: new Date(leg.endDate),
          transport: leg.transport,
          laundryAvailable: leg.laundryAvailable,
          laundryIntervalDays: leg.laundryIntervalDays ?? null,
          weatherTags: JSON.stringify(leg.weatherTags),
          dressCodes: JSON.stringify(leg.dressCodes),
          sortOrder: idx,
        })),
      },
      suitcases: {
        create: plans.map((plan) => {
          const isShared = plan.ownerRole === "shared";
          const ownerUserId =
            plan.ownerRole === "owner"
              ? user.id
              : plan.ownerRole === "partner"
                ? partnerUserId
                : user.id;
          return {
            name: plan.name,
            size: plan.size as SuitcaseSize,
            isShared,
            ownerUserId: ownerUserId || user.id,
          };
        }),
      },
      items: {
        create: items.map((item) => ({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          isShared: item.isShared,
          priority: item.priority || "NORMAL",
          notes: item.notes,
          source: item.source,
        })),
      },
    },
    include: {
      legs: { orderBy: { sortOrder: "asc" } },
      items: true,
      suitcases: true,
      members: { include: { user: true } },
      owner: true,
    },
  });

  const bags = trip.suitcases;
  const shared = bags.find((s) => s.isShared) || bags.find((s) => s.size === "CABIN");
  const ownerBags = bags.filter(
    (s) => !s.isShared && s.ownerUserId === user.id
  );
  const partnerBags = partnerUserId
    ? bags.filter((s) => !s.isShared && s.ownerUserId === partnerUserId)
    : [];

  await Promise.all(
    trip.items.map(async (item, idx) => {
      const calc = items[idx];
      let suitcaseId = shared?.id;
      if (calc && !calc.isShared) {
        if (calc.assigneeKey === user.id) {
          suitcaseId = ownerBags[0]?.id ?? suitcaseId;
        } else if (calc.assigneeKey === "partner-pending") {
          suitcaseId = partnerBags[0]?.id ?? suitcaseId;
        }
      }
      if (!suitcaseId) return;
      return prisma.packItem.update({
        where: { id: item.id },
        data: { suitcaseId },
      });
    })
  );

  return prisma.trip.findUniqueOrThrow({
    where: { id: trip.id },
    include: tripInclude,
  });
}

/**
 * Clone only the itinerary into a fresh trip for another group.
 * No items, no AI insights, no shared membership with the source trip.
 */
export async function createTripFromRouteShare(
  sourceTripId: string,
  owner: { id: string; name: string },
  opts?: { title?: string }
) {
  const source = await prisma.trip.findUnique({
    where: { id: sourceTripId },
    include: { legs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source || source.legs.length === 0) {
    const err = new Error("Route hat keine Etappen") as Error & {
      status: number;
    };
    err.status = 400;
    throw err;
  }

  const shareCheck = routeShareStatus({
    routeShareCode: source.routeShareCode,
    routeShareEnabled: source.routeShareEnabled,
    routeShareExpiresAt: source.routeShareExpiresAt,
    routeShareMaxUses: source.routeShareMaxUses,
    routeShareUseCount: source.routeShareUseCount,
  });
  if (!shareCheck.ok) {
    const err = new Error(shareCheck.reason || "Route-Code ungültig") as Error & {
      status: number;
    };
    err.status = 400;
    throw err;
  }

  const inviteCode = await allocateInviteCode();
  const title =
    (opts?.title || "").trim().slice(0, 80) ||
    `Route: ${source.title}`.slice(0, 80);

  const starts = source.legs.map((l) => l.startDate.getTime());
  const ends = source.legs.map((l) => l.endDate.getTime());

  const trip = await prisma.$transaction(async (tx) => {
    const locked = await tx.trip.findUnique({ where: { id: source.id } });
    if (!locked) {
      const err = new Error("Route nicht gefunden") as Error & {
        status: number;
      };
      err.status = 404;
      throw err;
    }
    const again = routeShareStatus(locked);
    if (!again.ok) {
      const err = new Error(again.reason || "Route-Code ungültig") as Error & {
        status: number;
      };
      err.status = 400;
      throw err;
    }

    const created = await tx.trip.create({
      data: {
        title,
        startDate: new Date(Math.min(...starts)),
        endDate: new Date(Math.max(...ends)),
        inviteCode,
        inviteEnabled: true,
        inviteExpiresAt: defaultInviteExpiry(),
        inviteMaxUses: null,
        inviteUseCount: 0,
        ownerId: owner.id,
        aiInsights: "{}",
        members: {
          create: [{ userId: owner.id, role: "OWNER" }],
        },
        legs: {
          create: source.legs.map((leg, idx) => ({
            name: leg.name,
            location: leg.location,
            startDate: leg.startDate,
            endDate: leg.endDate,
            transport: leg.transport,
            laundryAvailable: leg.laundryAvailable,
            laundryIntervalDays: leg.laundryIntervalDays,
            weatherTags: leg.weatherTags,
            dressCodes: leg.dressCodes,
            sortOrder: idx,
          })),
        },
        suitcases: {
          create: [
            {
              name: `Koffer 1 (${owner.name})`,
              size: "MEDIUM",
              isShared: false,
              ownerUserId: owner.id,
            },
            {
              name: "Handgepäck / Gemeinsam",
              size: "CABIN",
              isShared: true,
              ownerUserId: owner.id,
            },
          ],
        },
      },
    });

    const nextCount = locked.routeShareUseCount + 1;
    const exhausted =
      locked.routeShareMaxUses != null &&
      nextCount >= locked.routeShareMaxUses;

    await tx.trip.update({
      where: { id: source.id },
      data: {
        routeShareUseCount: nextCount,
        ...(exhausted ? { routeShareEnabled: false } : {}),
      },
    });

    return created;
  });

  return prisma.trip.findUniqueOrThrow({
    where: { id: trip.id },
    include: tripInclude,
  });
}

/**
 * When someone joins a trip after creation, create their personal suitcase
 * and personal pack items (templates/wizard only generate for travelers known
 * at create time).
 */
export async function ensureMemberPackKit(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      legs: { orderBy: { sortOrder: "asc" } },
      suitcases: true,
      items: true,
      members: { include: { user: true } },
    },
  });
  if (!trip) return;

  const member = trip.members.find((m) => m.userId === userId);
  if (!member) return;
  const person = member.user;

  let bag = trip.suitcases.find(
    (s) => !s.isShared && s.ownerUserId === userId
  );
  if (!bag) {
    bag = await prisma.suitcase.create({
      data: {
        tripId,
        name: `Koffer (${person.name})`,
        size: "MEDIUM",
        isShared: false,
        ownerUserId: userId,
      },
    });
  }

  const nameNeedle = `für ${person.name}`.toLowerCase();
  // Claim personal items that were named for this person but landed in another bag
  const misplaced = trip.items.filter(
    (i) =>
      !i.isShared &&
      i.suitcaseId !== bag!.id &&
      (i.notes || "").toLowerCase().includes(nameNeedle)
  );
  if (misplaced.length > 0) {
    await prisma.packItem.updateMany({
      where: { id: { in: misplaced.map((i) => i.id) } },
      data: { suitcaseId: bag.id },
    });
  }

  const alreadyOnBag = await prisma.packItem.count({
    where: { tripId, isShared: false, suitcaseId: bag.id },
  });

  const legs = trip.legs.map((leg) => ({
    name: leg.name,
    location: leg.location,
    startDate: formatISO(startOfDay(leg.startDate), { representation: "date" }),
    endDate: formatISO(startOfDay(leg.endDate), { representation: "date" }),
    transport: leg.transport as
      | "SHIP"
      | "FLIGHT"
      | "CAR"
      | "TRAIN"
      | "OTHER",
    laundryAvailable: leg.laundryAvailable,
    laundryIntervalDays: leg.laundryIntervalDays,
    weatherTags: JSON.parse(leg.weatherTags) as WeatherTag[],
    dressCodes: JSON.parse(leg.dressCodes) as DressCode[],
  }));

  // Always top up personal basics if the joiner has few items (2nd, 3rd person, child, …)
  if (alreadyOnBag < 8) {
    const noLaundryDays = daysWithoutLaundry(legs);
    const reserve = noLaundryDays >= 10 ? 2 : 1;
    const personal = personalItemsForTraveler(
      legs,
      {
        key: userId,
        name: person.name,
        gender: (person.gender as PackGender) || "UNSPECIFIED",
      },
      noLaundryDays,
      reserve
    );

    const existingNames = new Set(
      (
        await prisma.packItem.findMany({
          where: { tripId, suitcaseId: bag.id },
          select: { name: true },
        })
      ).map((i) => i.name.toLowerCase())
    );

    const toAdd = personal.filter(
      (item) => !existingNames.has(item.name.toLowerCase())
    );
    if (toAdd.length > 0) {
      await prisma.packItem.createMany({
        data: toAdd.map((item) => ({
          tripId,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          isShared: false,
          priority:
            item.priority ||
            inferPriority(item.name, item.category, item.notes),
          notes: item.notes || `für ${person.name}`,
          source: item.source || "calculator",
          suitcaseId: bag!.id,
        })),
      });
    }
  }
}

/** Ensure every current member has a personal suitcase + basics (any Nth joiner). */
export async function ensureAllMembersPackKits(tripId: string) {
  const members = await prisma.tripMember.findMany({
    where: { tripId },
    select: { userId: true },
  });
  for (const m of members) {
    await ensureMemberPackKit(tripId, m.userId);
  }
}

export const tripInclude = {
  legs: { orderBy: { sortOrder: "asc" as const } },
  items: {
    include: {
      packedBy: true,
      suitcase: true,
    },
    orderBy: [{ category: "asc" as const }, { name: "asc" as const }],
  },
  suitcases: { include: { owner: true }, orderBy: { name: "asc" as const } },
  members: { include: { user: true } },
  owner: true,
};

export function serializeTrip(
  trip: Awaited<ReturnType<typeof createTripFromDraft>>
) {
  return {
    ...trip,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    ...serializeInvite({
      inviteCode: trip.inviteCode,
      inviteEnabled: (trip as { inviteEnabled?: boolean }).inviteEnabled ?? true,
      inviteExpiresAt:
        (trip as { inviteExpiresAt?: Date | null }).inviteExpiresAt ?? null,
      inviteMaxUses:
        (trip as { inviteMaxUses?: number | null }).inviteMaxUses ?? null,
      inviteUseCount: (trip as { inviteUseCount?: number }).inviteUseCount ?? 0,
    }),
    ...serializeRouteShare({
      routeShareCode:
        (trip as { routeShareCode?: string | null }).routeShareCode ?? null,
      routeShareEnabled:
        (trip as { routeShareEnabled?: boolean }).routeShareEnabled ?? false,
      routeShareExpiresAt:
        (trip as { routeShareExpiresAt?: Date | null }).routeShareExpiresAt ??
        null,
      routeShareMaxUses:
        (trip as { routeShareMaxUses?: number | null }).routeShareMaxUses ??
        null,
      routeShareUseCount:
        (trip as { routeShareUseCount?: number }).routeShareUseCount ?? 0,
    }),
    aiInsights: parseAiInsights(
      (trip as { aiInsights?: string }).aiInsights
    ),
    legs: trip.legs.map((leg) => ({
      ...leg,
      location: (leg as { location?: string | null }).location || null,
      startDate: leg.startDate.toISOString(),
      endDate: leg.endDate.toISOString(),
      weatherTags: JSON.parse(leg.weatherTags) as string[],
      dressCodes: JSON.parse(leg.dressCodes) as string[],
    })),
    items: trip.items.map((item) => ({
      ...item,
      packedAt: item.packedAt?.toISOString() ?? null,
    })),
  };
}
