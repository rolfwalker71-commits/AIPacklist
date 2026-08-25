import { SHARED_COLOR } from "@/lib/colors";
import { resolvePackOwnerId } from "@/lib/pack-ownership";

export type ProgressMember = {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
  total: number;
  packed: number;
  pct: number;
};

export type PackProgress = {
  total: number;
  packed: number;
  pct: number;
  byMember: ProgressMember[];
  shared: { total: number; packed: number; pct: number };
  personal: { total: number; packed: number; pct: number };
};

type MemberUser = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
};

type ProgressItem = {
  packedAt?: string | Date | null;
  isShared?: boolean;
  ownerUserId?: string | null;
  notes?: string | null;
  suitcaseId?: string | null;
  suitcase?: {
    id: string;
    isShared?: boolean;
    ownerUserId?: string | null;
    owner?: MemberUser | null;
  } | null;
};

type ProgressTrip = {
  members: { user: MemberUser }[];
  suitcases: {
    id: string;
    isShared: boolean;
    ownerUserId: string | null;
    owner?: MemberUser | null;
  }[];
};

function resolveOwner(
  item: ProgressItem,
  trip: ProgressTrip
):
  | { kind: "shared" }
  | { kind: "user"; user: MemberUser }
  | { kind: "personal" } {
  const resolved = resolvePackOwnerId(item, {
    members: trip.members.map((m) => ({ id: m.user.id, name: m.user.name })),
    suitcases: trip.suitcases,
  });
  if (resolved.kind === "shared") return { kind: "shared" };
  if (resolved.kind === "user") {
    const u = trip.members.find((m) => m.user.id === resolved.userId)?.user;
    if (u) return { kind: "user", user: u };
  }
  return { kind: "personal" };
}

function pct(packed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((packed / total) * 100);
}

/** Item-count progress per member + shared (not quantity-weighted). */
export function computePackProgress(
  items: ProgressItem[],
  trip: ProgressTrip
): PackProgress {
  const byId = new Map<
    string,
    ProgressMember & { _t: number; _p: number }
  >();
  for (const m of trip.members) {
    byId.set(m.user.id, {
      userId: m.user.id,
      name: m.user.name,
      color: m.user.color,
      avatarUrl: m.user.avatarUrl,
      total: 0,
      packed: 0,
      pct: 0,
      _t: 0,
      _p: 0,
    });
  }

  let sharedT = 0;
  let sharedP = 0;
  let personalT = 0;
  let personalP = 0;
  let packed = 0;

  for (const item of items) {
    const isPacked = Boolean(item.packedAt);
    if (isPacked) packed += 1;
    const owner = resolveOwner(item, trip);
    if (owner.kind === "user") {
      const row = byId.get(owner.user.id);
      if (row) {
        row._t += 1;
        if (isPacked) row._p += 1;
      } else {
        personalT += 1;
        if (isPacked) personalP += 1;
      }
    } else if (owner.kind === "shared") {
      sharedT += 1;
      if (isPacked) sharedP += 1;
    } else {
      personalT += 1;
      if (isPacked) personalP += 1;
    }
  }

  const total = items.length;
  const byMember = [...byId.values()].map((r) => ({
    userId: r.userId,
    name: r.name,
    color: r.color,
    avatarUrl: r.avatarUrl,
    total: r._t,
    packed: r._p,
    pct: pct(r._p, r._t),
  }));

  return {
    total,
    packed,
    pct: pct(packed, total),
    byMember,
    shared: {
      total: sharedT,
      packed: sharedP,
      pct: pct(sharedP, sharedT),
    },
    personal: {
      total: personalT,
      packed: personalP,
      pct: pct(personalP, personalT),
    },
  };
}

export { SHARED_COLOR };
