"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  MapPinned,
  Share2,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { PushOptInCard } from "@/components/app/push-opt-in";
import { TeamMotif } from "@/components/app/travel-motif";
import { Button } from "@/components/ui/button";
import { computePackProgress } from "@/lib/pack-progress";
import { formatDate } from "@/lib/utils";

type MemberUser = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
};

type TeamTrip = {
  title: string;
  ownerId?: string;
  inviteCode: string;
  inviteEnabled?: boolean;
  inviteExpiresAt?: string | null;
  inviteMaxUses?: number | null;
  inviteUseCount?: number;
  inviteValid?: boolean;
  inviteInvalidReason?: string | null;
  routeShareCode?: string | null;
  routeShareEnabled?: boolean;
  routeShareExpiresAt?: string | null;
  routeShareMaxUses?: number | null;
  routeShareUseCount?: number;
  routeShareValid?: boolean;
  routeShareInvalidReason?: string | null;
  members: { id?: string; role: string; user: MemberUser }[];
  items: {
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
  }[];
  suitcases: {
    id: string;
    isShared: boolean;
    ownerUserId: string | null;
    owner?: MemberUser | null;
  }[];
};

function roleLabel(trip: TeamTrip, member: TeamTrip["members"][number]) {
  if (member.user.id === trip.ownerId || member.role === "OWNER") {
    return "Besitzer:in";
  }
  if (member.role === "PARTNER") return "Mitreisende:r";
  return member.role;
}

export function TripTeamPanel({
  trip,
  userId,
  isTripOwner,
  copied,
  routeCopied,
  onCopyInvite,
  onPatchInvite,
  onCopyRoute,
  onPatchRoute,
  onRemoveMember,
  canRemoveMember,
  onLeaveOrDelete,
}: {
  trip: TeamTrip;
  userId: string;
  isTripOwner: boolean;
  copied: boolean;
  routeCopied: boolean;
  onCopyInvite: () => void;
  onPatchInvite: (body: Record<string, unknown>) => void;
  onCopyRoute: () => void;
  onPatchRoute: (body: Record<string, unknown>) => void;
  onRemoveMember: (userId: string) => void;
  canRemoveMember: (userId: string) => boolean;
  onLeaveOrDelete: () => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const progress = computePackProgress(trip.items, trip);

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-teal-800 via-teal-700 to-blue-800 px-4 py-5 text-teal-50 shadow-md">
        <TeamMotif className="absolute -right-1 bottom-0 h-28 w-40 opacity-50" />
        <p className="text-eyebrow text-teal-100/80">Gruppe</p>
        <h2 className="mt-1 font-display text-section-title">Wer ist dabei</h2>
        <p className="mt-1 max-w-md text-base text-teal-50/85">
          Personen, Einladung zur Packliste — und optional die Route als
          Vorlage.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h3 className="font-display text-section-title text-stone-900">
              Personen
            </h3>
            <Link
              href="/profil"
              className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800"
            >
              <UserRound className="h-3.5 w-3.5" />
              Profil ändern
            </Link>
          </div>
          <ul className="space-y-3">
            {trip.members.map((m) => {
              const stats = progress.byMember.find(
                (row) => row.userId === m.user.id
              );
              const mine = m.user.id === userId;
              const pct = stats?.pct ?? 0;
              return (
                <li
                  key={m.id || m.user.id}
                  className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-3 shadow-sm"
                >
                  {m.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.user.avatarUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-stone-200"
                    />
                  ) : (
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
                      style={{ background: m.user.color }}
                    >
                      {m.user.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-950">
                      {m.user.name}
                      {mine ? " (ich)" : ""}
                    </p>
                    <p className="text-sm text-stone-500">{roleLabel(trip, m)}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
                      <div
                        className="h-full rounded-full bg-teal-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {stats
                        ? `${stats.packed}/${stats.total} gepackt`
                        : "Keine Positionen"}
                    </p>
                  </div>
                  {canRemoveMember(m.user.id) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveMember(m.user.id)}
                      aria-label={`${m.user.name} entfernen`}
                    >
                      Entfernen
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <Users className="h-4 w-4 text-teal-800" />
              Packliste teilen
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Mitreisende treten der gemeinsamen Packliste bei — nicht nur der
              Route.
            </p>
            <Button
              className="mt-3 w-full"
              onClick={onCopyInvite}
              disabled={trip.inviteValid === false}
            >
              <Share2 className="h-4 w-4" />
              {copied ? "Link kopiert" : "Person einladen"}
            </Button>
            {trip.inviteValid === false && (
              <p className="mt-2 text-sm text-rose-700">
                {trip.inviteInvalidReason || "Einladung ungültig"}
              </p>
            )}
            {isTripOwner && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setInviteOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition ${inviteOpen ? "rotate-180" : ""}`}
                  />
                  Code & Optionen
                </button>
                {inviteOpen && (
                  <div className="mt-3 space-y-3 border-t border-stone-200 pt-3">
                    <p className="text-sm text-stone-600">
                      Code <strong>{trip.inviteCode}</strong>
                      {trip.inviteExpiresAt && (
                        <> · gültig bis {formatDate(trip.inviteExpiresAt)}</>
                      )}
                      {trip.inviteMaxUses != null && (
                        <>
                          {" "}
                          · {trip.inviteUseCount ?? 0}/{trip.inviteMaxUses}×
                          genutzt
                        </>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onPatchInvite({ regenerate: true, singleUse: false })
                        }
                      >
                        Code erneuern
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onPatchInvite({ regenerate: true, singleUse: true })
                        }
                      >
                        Einmal-Code
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPatchInvite({ extendDays: true })}
                      >
                        +30 Tage
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onPatchInvite({
                            inviteEnabled: !(trip.inviteEnabled !== false),
                          })
                        }
                      >
                        {trip.inviteEnabled === false
                          ? "Einladung aktivieren"
                          : "Einladung pausieren"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <MapPinned className="h-4 w-4 text-amber-800" />
              Nur Route als Vorlage
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Andere starten eine eigene Reise mit denselben Etappen — ohne
              Packliste, Koffer oder Tipps.
            </p>
            {trip.routeShareCode ? (
              <p className="mt-2 text-sm text-stone-600">
                Code <strong>{trip.routeShareCode}</strong>
                {trip.routeShareExpiresAt && (
                  <> · gültig bis {formatDate(trip.routeShareExpiresAt)}</>
                )}
                {trip.routeShareMaxUses != null && (
                  <>
                    {" "}
                    · {trip.routeShareUseCount ?? 0}/{trip.routeShareMaxUses}×
                    genutzt
                  </>
                )}
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-500">
                Noch kein Route-Code — Besitzer:in kann einen erzeugen.
              </p>
            )}
            {trip.routeShareCode && trip.routeShareValid === false && (
              <p className="mt-1 text-sm text-rose-700">
                {trip.routeShareInvalidReason || "Route-Code ungültig"}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {trip.routeShareCode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCopyRoute}
                  disabled={trip.routeShareValid === false}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {routeCopied ? "Kopiert" : "Route-Link kopieren"}
                </Button>
              )}
              {isTripOwner && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onPatchRoute({ regenerate: true, singleUse: false })
                    }
                  >
                    {trip.routeShareCode
                      ? "Route-Code erneuern"
                      : "Route-Code erzeugen"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onPatchRoute({ regenerate: true, singleUse: true })
                    }
                  >
                    Einmal-Route
                  </Button>
                  {trip.routeShareCode && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPatchRoute({ extendDays: true })}
                      >
                        +30 Tage
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onPatchRoute({
                            enabled: !(trip.routeShareEnabled !== false),
                          })
                        }
                      >
                        {trip.routeShareEnabled === false
                          ? "Route-Teilen aktivieren"
                          : "Route-Teilen pausieren"}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <PushOptInCard />

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-950">
              {isTripOwner ? "Reise löschen" : "Reise verlassen"}
            </p>
            <p className="mt-1 text-sm text-rose-900/80">
              {isTripOwner
                ? "Löscht die gesamte Packliste für alle Mitreisenden."
                : "Du verschwindest aus der Gruppe; die Reise bleibt für die anderen bestehen."}
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={onLeaveOrDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isTripOwner ? "Reise löschen" : "Verlassen"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
