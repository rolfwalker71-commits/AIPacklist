import { prisma } from "./db";
import { buildPackList } from "./ai-pack";
import { stringifyAiInsights, parseAiInsights } from "./ai-insights";
import {
  allocateInviteCode,
  defaultInviteExpiry,
  serializeInvite,
} from "./invite";
import { USER_COLORS } from "./utils";
import type { PackGender, TripDraft } from "./types";
import type { SuitcasePlan, SuitcaseSize } from "./suitcases";

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
