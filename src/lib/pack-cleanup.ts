import {
  dedupeOwnerKey,
  packNamesSimilar,
  type DedupeItem,
} from "@/lib/pack-dedupe";
import { mergePriority, type PackPriority } from "@/lib/priority";

export type CleanupItem = DedupeItem & {
  id: string;
  quantity: number;
  priority: PackPriority;
  packedAt?: string | Date | null;
  photoUrl?: string | null;
  createdAt?: string | Date | null;
};

export type DuplicateGroup = {
  ownerKey: string;
  survivorId: string;
  loserIds: string[];
  names: string[];
};

/** Scan for semantic duplicate groups (same owner + similar names). */
export function findDuplicateGroups(items: CleanupItem[]): DuplicateGroup[] {
  const byOwner = new Map<string, CleanupItem[]>();
  for (const item of items) {
    const key = dedupeOwnerKey(item);
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key)!.push(item);
  }

  const groups: DuplicateGroup[] = [];

  for (const [who, list] of byOwner) {
    const used = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      if (used.has(list[i].id)) continue;
      const cluster = [list[i]];
      used.add(list[i].id);
      for (let j = i + 1; j < list.length; j++) {
        if (used.has(list[j].id)) continue;
        if (packNamesSimilar(list[i].name, list[j].name)) {
          cluster.push(list[j]);
          used.add(list[j].id);
        }
      }
      if (cluster.length < 2) continue;

      // Prefer packed, then oldest (createdAt), then stable id
      const sorted = [...cluster].sort((a, b) => {
        const ap = a.packedAt ? 0 : 1;
        const bp = b.packedAt ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (at !== bt) return at - bt;
        return a.id.localeCompare(b.id);
      });
      const survivor = sorted[0];
      groups.push({
        ownerKey: who,
        survivorId: survivor.id,
        loserIds: sorted.slice(1).map((c) => c.id),
        names: cluster.map((c) => c.name),
      });
    }
  }

  return groups;
}

export type MergePlan = {
  survivorId: string;
  loserIds: string[];
  quantity: number;
  priority: PackPriority;
  notes: string | null;
  photoUrl: string | null;
  packedAt: Date | null;
  packedByUserId: string | null;
  name: string;
};

export function buildMergePlans(
  items: (CleanupItem & {
    packedByUserId?: string | null;
  })[],
  groups: DuplicateGroup[]
): MergePlan[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const plans: MergePlan[] = [];

  for (const g of groups) {
    const cluster = [g.survivorId, ...g.loserIds]
      .map((id) => byId.get(id))
      .filter(Boolean) as (CleanupItem & {
      packedByUserId?: string | null;
    })[];
    if (cluster.length < 2) continue;

    const survivor = cluster.find((c) => c.id === g.survivorId) || cluster[0];
    let quantity = 0;
    let priority: PackPriority = survivor.priority || "NORMAL";
    const noteParts: string[] = [];
    let photoUrl: string | null = survivor.photoUrl || null;
    let packedAt: Date | null = survivor.packedAt
      ? new Date(survivor.packedAt)
      : null;
    let packedByUserId: string | null = survivor.packedByUserId || null;

    for (const c of cluster) {
      quantity += Math.max(1, c.quantity || 1);
      priority = mergePriority(priority, c.priority || "NORMAL");
      if (c.notes?.trim()) noteParts.push(c.notes.trim());
      if (!photoUrl && c.photoUrl) photoUrl = c.photoUrl;
      if (c.packedAt) {
        const d = new Date(c.packedAt);
        if (!packedAt || d < packedAt) {
          packedAt = d;
          packedByUserId = c.packedByUserId || packedByUserId;
        }
      }
    }

    // Deduplicate note fragments
    const uniqueNotes = [...new Set(noteParts)].join(" · ").slice(0, 200);

    plans.push({
      survivorId: survivor.id,
      loserIds: g.loserIds,
      quantity: Math.min(99, quantity),
      priority,
      notes: uniqueNotes || null,
      photoUrl,
      packedAt,
      packedByUserId,
      name: survivor.name,
    });
  }

  return plans;
}

export function countDuplicateLosers(groups: DuplicateGroup[]): number {
  return groups.reduce((n, g) => n + g.loserIds.length, 0);
}
