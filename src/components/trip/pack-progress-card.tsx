"use client";

import { Track } from "@/components/ui/glass";
import { computePackProgress, SHARED_COLOR } from "@/lib/pack-progress";

type MemberUser = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
};

type PackItem = {
  packedAt: string | null;
  isShared: boolean;
  ownerUserId?: string | null;
  notes: string | null;
  suitcaseId: string | null;
  suitcase?: {
    id: string;
    isShared?: boolean;
    ownerUserId?: string | null;
    owner?: MemberUser | null;
  } | null;
};

type TripLike = {
  members: { user: MemberUser }[];
  suitcases: {
    id: string;
    isShared: boolean;
    ownerUserId: string | null;
    owner?: MemberUser | null;
  }[];
  items: PackItem[];
};

function Avatar({
  name,
  color,
  avatarUrl,
}: {
  name: string;
  color: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-[rgba(255,255,255,0.65)] dark:ring-[rgba(255,255,255,0.14)]"
      />
    );
  }
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-[rgba(255,255,255,0.65)] dark:ring-[rgba(255,255,255,0.14)]"
      style={{ background: color }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Live «Wer ist wie weit?» — derived from items, no extra toasts. */
export function PackProgressCard({ trip }: { trip: TripLike }) {
  const progress = computePackProgress(trip.items, trip);
  if (progress.total === 0) {
    return (
      <div className="glass rounded-[var(--r-lg)] p-4 text-sm text-muted-foreground">
        Noch keine Packpositionen — Fortschritt erscheint sobald die Liste steht.
      </div>
    );
  }

  return (
    <div className="glass space-y-3 rounded-[var(--r-lg)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-card-title text-foreground">
          Fortschritt
        </h3>
        <span className="text-sm font-bold text-primary">
          {progress.packed}/{progress.total} · {progress.pct} %
        </span>
      </div>
      <Track pct={progress.pct} />
      <ul className="space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-x-5 sm:space-y-0 lg:grid-cols-3">
        {progress.byMember.map((m) => (
          <li key={m.userId} className="flex items-center gap-2.5 sm:py-1">
            <Avatar name={m.name} color={m.color} avatarUrl={m.avatarUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-sm">
                <span className="truncate font-semibold text-foreground">
                  {m.name}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {m.total === 0 ? "—" : `${m.packed}/${m.total}`}
                </span>
              </div>
              <Track pct={m.pct} color={m.color} slim className="mt-1" />
            </div>
          </li>
        ))}
        {progress.shared.total > 0 && (
          <li className="flex items-center gap-2.5 sm:py-1">
            <Avatar name="Gemeinsam" color={SHARED_COLOR} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-sm">
                <span className="truncate font-semibold text-foreground">
                  Gemeinsam
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {progress.shared.packed}/{progress.shared.total}
                </span>
              </div>
              <Track
                pct={progress.shared.pct}
                color={SHARED_COLOR}
                slim
                className="mt-1"
              />
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
