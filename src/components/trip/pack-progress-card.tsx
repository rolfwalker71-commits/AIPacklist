"use client";

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

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/** Live «Wer ist wie weit?» — derived from items, no extra toasts. */
export function PackProgressCard({ trip }: { trip: TripLike }) {
  const progress = computePackProgress(trip.items, trip);
  if (progress.total === 0) {
    return (
      <div className="card-surface p-4 text-sm text-stone-500">
        Noch keine Packpositionen — Fortschritt erscheint sobald die Liste steht.
      </div>
    );
  }

  return (
    <div className="card-surface space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-stone-900">Fortschritt</h3>
        <span className="text-sm font-semibold text-teal-800">
          {progress.packed}/{progress.total} · {progress.pct}%
        </span>
      </div>
      <Bar pct={progress.pct} color="#0F766E" />
      <ul className="space-y-2.5">
        {progress.byMember.map((m) => (
          <li key={m.userId} className="flex items-center gap-2.5">
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: m.color }}
              >
                {m.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-sm">
                <span className="truncate font-medium text-stone-800">
                  {m.name}
                </span>
                <span className="shrink-0 text-stone-500">
                  {m.total === 0 ? "—" : `${m.packed}/${m.total}`}
                </span>
              </div>
              <Bar pct={m.pct} color={m.color} />
            </div>
          </li>
        ))}
        {progress.shared.total > 0 && (
          <li className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ background: SHARED_COLOR }}
            >
              G
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-stone-800">Gemeinsam</span>
                <span className="text-stone-500">
                  {progress.shared.packed}/{progress.shared.total}
                </span>
              </div>
              <Bar pct={progress.shared.pct} color={SHARED_COLOR} />
            </div>
          </li>
        )}
        {progress.personal.total > 0 && (
          <li className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-400 text-[10px] font-semibold text-white">
              ?
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-stone-800">Persönlich</span>
                <span className="text-stone-500">
                  {progress.personal.packed}/{progress.personal.total}
                </span>
              </div>
              <Bar pct={progress.personal.pct} color="#78716c" />
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
