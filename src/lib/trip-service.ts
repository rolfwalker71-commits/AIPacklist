import { prisma } from "./db";
import { calculatePackList } from "./calculator";
import { generateInviteCode, USER_COLORS } from "./utils";
import type { PackGender, TripDraft } from "./types";

export type UserInput = {
  id?: string;
  name: string;
  color?: string;
  gender?: PackGender;
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
    },
  });
}

export async function createTripFromDraft(
  draft: TripDraft,
  owner: UserInput,
  partner?: UserInput
) {
  const user = await ensureUser(owner);
  let inviteCode = generateInviteCode();
  while (await prisma.trip.findUnique({ where: { inviteCode } })) {
    inviteCode = generateInviteCode();
  }

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

  const items = calculatePackList(draft.legs, travelers);

  const trip = await prisma.trip.create({
    data: {
      title: draft.title,
      startDate: new Date(draft.startDate),
      endDate: new Date(draft.endDate),
      inviteCode,
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
      legs: {
        create: draft.legs.map((leg, idx) => ({
          name: leg.name,
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
        create: [
          { name: `Koffer 1 (${user.name})`, ownerUserId: user.id },
          ...(partner?.name
            ? [
                {
                  name: `Koffer 2 (${partner.name})`,
                  ownerUserId: undefined as string | undefined,
                },
              ]
            : []),
          { name: "Handgepäck / Shared", ownerUserId: user.id },
        ],
      },
      items: {
        create: items.map((item) => ({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          isShared: item.isShared,
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

  let partnerUserId: string | undefined;
  if (partner?.name) {
    const partnerUser = await ensureUser({
      name: partner.name,
      color: partner.color ?? USER_COLORS[1],
      gender: partner.gender,
    });
    partnerUserId = partnerUser.id;
    await prisma.tripMember.create({
      data: { tripId: trip.id, userId: partnerUser.id, role: "PARTNER" },
    });
    const partnerBag = trip.suitcases.find((s) =>
      s.name.includes(partner.name)
    );
    if (partnerBag) {
      await prisma.suitcase.update({
        where: { id: partnerBag.id },
        data: {
          name: `Koffer 2 (${partner.name})`,
          ownerUserId: partnerUser.id,
        },
      });
    }
  }

  const sharedBag = trip.suitcases.find((s) => s.name.includes("Shared"));
  const ownerBag = trip.suitcases.find((s) => s.ownerUserId === user.id && !s.name.includes("Shared"));
  const partnerBag = partnerUserId
    ? trip.suitcases.find((s) => s.name.includes(partner!.name))
    : undefined;

  // Re-fetch suitcases after partner update
  const bags = await prisma.suitcase.findMany({ where: { tripId: trip.id } });
  const shared = bags.find((s) => s.name.includes("Shared"));
  const bagOwner = bags.find(
    (s) => s.ownerUserId === user.id && !s.name.includes("Shared")
  );
  const bagPartner = partnerUserId
    ? bags.find((s) => s.ownerUserId === partnerUserId)
    : undefined;

  await Promise.all(
    trip.items.map(async (item, idx) => {
      const calc = items[idx];
      let suitcaseId = shared?.id ?? sharedBag?.id;
      if (calc && !calc.isShared) {
        if (calc.assigneeKey === user.id) {
          suitcaseId = bagOwner?.id ?? ownerBag?.id ?? suitcaseId;
        } else if (calc.assigneeKey === "partner-pending") {
          suitcaseId = bagPartner?.id ?? partnerBag?.id ?? suitcaseId;
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

export const tripInclude = {
  legs: { orderBy: { sortOrder: "asc" as const } },
  items: {
    include: {
      packedBy: true,
      suitcase: true,
    },
    orderBy: [{ category: "asc" as const }, { name: "asc" as const }],
  },
  suitcases: { include: { owner: true } },
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
    legs: trip.legs.map((leg) => ({
      ...leg,
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
