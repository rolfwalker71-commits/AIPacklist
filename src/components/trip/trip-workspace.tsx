"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Link2,
  Users,
  Luggage,
  MapPinned,
  Share2,
  Sparkles,
  Clock,
  ListChecks,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenderPicker } from "@/components/ui/gender-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { SwipeRow } from "@/components/ui/swipe-row";
import { TravelMotif, SuitcaseCardArt, ChecklistMotif, TipsMotif, TeamMotif } from "@/components/app/travel-motif";
import { BrandLogo } from "@/components/app/brand-logo";
import { AddPackItemForm } from "@/components/trip/add-pack-item-form";
import {
  ParticipantFilter,
  sharedFilterOption,
} from "@/components/trip/participant-filter";
import { cn, formatDate } from "@/lib/utils";
import type { PackGender, Transport } from "@/lib/types";
import { SUITCASE_SIZES } from "@/lib/suitcases";
import { SHARED_COLOR, tileStyle } from "@/lib/colors";
import { LOCATION_PRESETS } from "@/lib/locations";
import {
  priorityLabel,
  priorityRank,
  resolvePriority,
  type PackPriority,
} from "@/lib/priority";

type SessionUserProp = {
  id: string;
  name: string;
  username: string;
  role: string;
  color: string;
  gender: PackGender;
  avatarUrl?: string | null;
};

type MemberUser = {
  id: string;
  name: string;
  color: string;
  gender?: string;
  avatarUrl?: string | null;
};

type PackItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  isShared: boolean;
  priority?: PackPriority;
  notes: string | null;
  packedAt: string | null;
  packedByUserId: string | null;
  suitcaseId: string | null;
  packedBy?: MemberUser | null;
  suitcase?: {
    id: string;
    name: string;
    isShared?: boolean;
    ownerUserId?: string | null;
    owner?: MemberUser | null;
  } | null;
};

type TripLeg = {
  id: string;
  name: string;
  location?: string | null;
  transport: string;
  laundryAvailable: boolean;
  weatherTags: string[];
  dressCodes: string[];
  startDate: string;
  endDate: string;
};

type AiInsights = {
  tips: string[];
  guides: { title: string; body: string }[];
  updatedAt?: string | null;
};

type Trip = {
  id: string;
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
  startDate: string;
  endDate: string;
  aiInsights?: AiInsights;
  legs: TripLeg[];
  items: PackItem[];
  suitcases: {
    id: string;
    name: string;
    size: string;
    isShared: boolean;
    ownerUserId: string | null;
    owner?: MemberUser | null;
  }[];
  members: {
    id?: string;
    role: string;
    user: MemberUser;
  }[];
};

type TripTab = "pack" | "legs" | "bags" | "ai" | "people";

const TRANSPORT_LABELS: Record<string, string> = {
  SHIP: "Schiff",
  FLIGHT: "Flug",
  CAR: "Auto",
  TRAIN: "Zug",
  OTHER: "Sonstiges",
};

const TRANSPORT_OPTIONS: { id: Transport; label: string }[] = [
  { id: "SHIP", label: "Schiff" },
  { id: "FLIGHT", label: "Flug" },
  { id: "CAR", label: "Auto" },
  { id: "TRAIN", label: "Zug" },
  { id: "OTHER", label: "Sonstiges" },
];

function emptyInsights(): AiInsights {
  return { tips: [], guides: [], updatedAt: null };
}

function normalizeInsights(raw?: AiInsights | null): AiInsights {
  if (!raw) return emptyInsights();
  return {
    tips: Array.isArray(raw.tips) ? raw.tips.map(String).filter(Boolean) : [],
    guides: Array.isArray(raw.guides)
      ? raw.guides
          .filter((g) => g && typeof g === "object")
          .map((g) => ({
            title: String(g.title || "Hinweis"),
            body: String(g.body || ""),
          }))
          .filter((g) => g.body)
      : [],
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function resolveItemOwner(
  item: PackItem,
  trip: Trip
):
  | { kind: "shared" }
  | { kind: "user"; user: MemberUser }
  | { kind: "personal" } {
  if (item.isShared) return { kind: "shared" };

  // Prefer explicit "für Name" over suitcase — AI often puts partner items in the wrong bag
  const noteMatch = item.notes?.match(/für\s+([^·]+)/i);
  if (noteMatch) {
    const name = noteMatch[1].trim().toLowerCase();
    const u = trip.members.find((m) => m.user.name.toLowerCase() === name)?.user;
    if (u) return { kind: "user", user: u };
  }

  const bag =
    trip.suitcases.find((s) => s.id === item.suitcaseId) ||
    (item.suitcase
      ? trip.suitcases.find((s) => s.id === item.suitcase?.id)
      : undefined);

  if (bag && !bag.isShared && bag.ownerUserId) {
    const u =
      trip.members.find((m) => m.user.id === bag.ownerUserId)?.user ||
      bag.owner ||
      null;
    if (u) return { kind: "user", user: u };
  }

  if (trip.members.length === 1) {
    return { kind: "user", user: trip.members[0].user };
  }

  return { kind: "personal" };
}

type OpenBucket = {
  key: string;
  label: string;
  color: string;
  open: number;
};

function openStats(items: PackItem[], trip: Trip): {
  total: number;
  openTotal: number;
  buckets: OpenBucket[];
} {
  const map = new Map<string, OpenBucket>();

  for (const item of items) {
    if (item.packedAt) continue;
    const owner = resolveItemOwner(item, trip);
    let key: string;
    let label: string;
    let color: string;
    if (owner.kind === "user") {
      key = owner.user.id;
      label = owner.user.name;
      color = owner.user.color;
    } else if (owner.kind === "shared") {
      key = "shared";
      label = "Gemeinsam";
      color = SHARED_COLOR;
    } else {
      key = "personal";
      label = "Persönlich";
      color = "#78716c";
    }
    const cur = map.get(key) || { key, label, color, open: 0 };
    cur.open += 1;
    map.set(key, cur);
  }

  const buckets: OpenBucket[] = [];
  for (const m of trip.members) {
    const b = map.get(m.user.id);
    if (b) buckets.push(b);
  }
  if (map.has("shared")) buckets.push(map.get("shared")!);
  if (map.has("personal")) buckets.push(map.get("personal")!);

  return {
    total: items.length,
    openTotal: items.filter((i) => !i.packedAt).length,
    buckets,
  };
}

const EARLY_SECTION_KEY = "__early__";

function loadOpenSections(tripId: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`flexipack_cats_open_${tripId}`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveOpenSections(tripId: string, state: Record<string, boolean>) {
  localStorage.setItem(`flexipack_cats_open_${tripId}`, JSON.stringify(state));
}

function loadTab(tripId: string): TripTab {
  if (typeof window === "undefined") return "pack";
  try {
    const raw = localStorage.getItem(`flexipack_trip_tab_${tripId}`);
    if (
      raw === "pack" ||
      raw === "legs" ||
      raw === "bags" ||
      raw === "ai" ||
      raw === "people"
    )
      return raw;
  } catch {
    // ignore
  }
  return "pack";
}

function saveTab(tripId: string, tab: TripTab) {
  localStorage.setItem(`flexipack_trip_tab_${tripId}`, tab);
}

export function TripWorkspace({
  initialTrip,
  sessionUser,
}: {
  initialTrip: Trip;
  sessionUser: SessionUserProp;
}) {
  const [trip, setTrip] = useState<Trip>(() => ({
    ...initialTrip,
    aiInsights: normalizeInsights(initialTrip.aiInsights),
  }));
  const [user, setUser] = useState<SessionUserProp>(sessionUser);
  const [filter, setFilter] = useState<"all" | "open" | "packed" | "shared">(
    "all"
  );
  const [suitcaseFilter, setSuitcaseFilter] = useState<string>("all");
  const [nameDraft, setNameDraft] = useState(sessionUser.name);
  const [genderDraft, setGenderDraft] = useState<PackGender>(
    sessionUser.gender || "UNSPECIFIED"
  );
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [participantFilter, setParticipantFilter] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [routeCopied, setRouteCopied] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<TripTab>("pack");
  const [headerDetails, setHeaderDetails] = useState(false);
  const [bagForm, setBagForm] = useState<{
    open: boolean;
    suitcaseId: string | null;
    name: string;
    size: string;
    assignee: string;
  }>({
    open: false,
    suitcaseId: null,
    name: "",
    size: "MEDIUM",
    assignee: "shared",
  });
  const [editingLegId, setEditingLegId] = useState<string | null>(null);
  const [legDraft, setLegDraft] = useState({
    name: "",
    location: "",
    startDate: "",
    endDate: "",
    transport: "OTHER" as Transport,
    laundryAvailable: false,
  });
  const [legBusy, setLegBusy] = useState(false);

  useEffect(() => {
    setUser(sessionUser);
    setNameDraft(sessionUser.name);
    setGenderDraft(sessionUser.gender || "UNSPECIFIED");
  }, [sessionUser]);

  useEffect(() => {
    setOpenSections(loadOpenSections(trip.id));
    setActiveTab(loadTab(trip.id));
  }, [trip.id]);

  useEffect(() => {
    if (!pendingAvatar) {
      setAvatarPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingAvatar);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingAvatar]);

  const setTab = (tab: TripTab) => {
    setActiveTab(tab);
    saveTab(trip.id, tab);
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveOpenSections(trip.id, next);
      return next;
    });
  };

  const isSectionOpen = (key: string) => Boolean(openSections[key]);

  useEffect(() => {
    const es = new EventSource(`/api/trips/${trip.id}/events`);
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        if (event.type === "item_updated" && event.payload) {
          setTrip((prev) => {
            if (event.payload.deleted) {
              return {
                ...prev,
                items: prev.items.filter((i) => i.id !== event.itemId),
              };
            }
            const exists = prev.items.some((i) => i.id === event.itemId);
            const patch = {
              ...event.payload,
              packedAt:
                event.payload.packedAt === undefined
                  ? undefined
                  : event.payload.packedAt
                    ? String(event.payload.packedAt)
                    : null,
            };
            const items = exists
              ? prev.items.map((i) =>
                  i.id === event.itemId ? { ...i, ...patch } : i
                )
              : event.payload.created
                ? [...prev.items, patch]
                : prev.items;
            return { ...prev, items };
          });
        }
        if (event.type === "member_joined" || event.type === "trip_updated") {
          fetch(`/api/trips/${trip.id}`)
            .then((r) => r.json())
            .then((data: Trip) =>
              setTrip({
                ...data,
                aiInsights: normalizeInsights(data.aiInsights),
              })
            )
            .catch(() => undefined);
        }
      } catch {
        // ignore
      }
    };
    return () => es.close();
  }, [trip.id]);

  const saveProfile = async () => {
    if (!nameDraft.trim() || profileBusy) return;
    setProfileBusy(true);
    setAvatarMessage(null);
    try {
      let avatarUrl = user.avatarUrl ?? null;

      if (pendingAvatar) {
        const body = new FormData();
        body.append("file", pendingAvatar);
        const res = await fetch("/api/avatars", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAvatarMessage(
            typeof data.error === "string"
              ? data.error
              : "Avatar konnte nicht hochgeladen werden"
          );
          return;
        }
        avatarUrl = data.avatarUrl ?? avatarUrl;
      }

      const next = {
        ...user,
        name: nameDraft.trim(),
        gender: genderDraft,
        avatarUrl,
      };
      setUser(next);

      const memberRes = await fetch(`/api/trips/${trip.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: {
            name: next.name,
            gender: next.gender,
            avatarUrl: next.avatarUrl,
          },
        }),
      });
      if (!memberRes.ok) {
        const data = await memberRes.json().catch(() => ({}));
        setAvatarMessage(
          typeof data.error === "string"
            ? data.error
            : "Profil konnte nicht gespeichert werden"
        );
        return;
      }

      const tripRes = await fetch(`/api/trips/${trip.id}`);
      if (tripRes.ok) {
        const tripData = await tripRes.json();
        setTrip({
          ...tripData,
          aiInsights: normalizeInsights(tripData.aiInsights),
        });
      }

      setPendingAvatar(null);
      setAvatarMessage("Profil gespeichert");
    } catch (e) {
      setAvatarMessage(
        e instanceof Error ? e.message : "Profil speichern fehlgeschlagen"
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (profileBusy) return;
    if (pendingAvatar && !user.avatarUrl) {
      setPendingAvatar(null);
      setAvatarMessage(null);
      return;
    }
    setProfileBusy(true);
    setAvatarMessage(null);
    try {
      const res = await fetch("/api/avatars", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAvatarMessage(
          typeof data.error === "string"
            ? data.error
            : "Avatar konnte nicht entfernt werden"
        );
        return;
      }
      const next = { ...user, avatarUrl: null };
      setUser(next);
      setPendingAvatar(null);
      await fetch(`/api/trips/${trip.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: {
            name: nameDraft.trim() || next.name,
            gender: genderDraft,
            avatarUrl: null,
          },
        }),
      });
      const tripRes = await fetch(`/api/trips/${trip.id}`);
      if (tripRes.ok) {
        const tripData = await tripRes.json();
        setTrip({
          ...tripData,
          aiInsights: normalizeInsights(tripData.aiInsights),
        });
      }
      setAvatarMessage("Avatar entfernt");
    } catch (e) {
      setAvatarMessage(
        e instanceof Error ? e.message : "Avatar entfernen fehlgeschlagen"
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const togglePacked = useCallback(
    async (item: PackItem) => {
      if (!user?.id) return;
      const packed = !item.packedAt;
      const prevPackedAt = item.packedAt;
      const prevPackedBy = item.packedBy;
      const prevPackedByUserId = item.packedByUserId;

      setTrip((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                packedAt: packed ? new Date().toISOString() : null,
                packedByUserId: packed ? user.id : null,
                packedBy: packed
                  ? {
                      id: user.id,
                      name: user.name,
                      color: user.color,
                      avatarUrl: user.avatarUrl,
                    }
                  : null,
              }
            : i
        ),
      }));

      try {
        const res = await fetch(`/api/trips/${trip.id}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            itemId: item.id,
            packed,
          }),
        });
        if (!res.ok) throw new Error("toggle failed");
        const data = await res.json().catch(() => null);
        if (data && typeof data.packedAt !== "undefined") {
          setTrip((prev) => ({
            ...prev,
            items: prev.items.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    packedAt: data.packedAt,
                    packedByUserId: data.packedByUserId ?? null,
                    packedBy: data.packedBy ?? null,
                  }
                : i
            ),
          }));
        }
      } catch {
        setTrip((prev) => ({
          ...prev,
          items: prev.items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  packedAt: prevPackedAt,
                  packedBy: prevPackedBy,
                  packedByUserId: prevPackedByUserId,
                }
              : i
          ),
        }));
      }
    },
    [trip.id, user]
  );

  const moveSuitcase = async (itemId: string, suitcaseId: string) => {
    setTrip((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              suitcaseId,
              suitcase: prev.suitcases.find((s) => s.id === suitcaseId) || null,
            }
          : i
      ),
    }));
    await fetch(`/api/trips/${trip.id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, suitcaseId }),
    });
  };

  const removeItem = async (itemId: string) => {
    setTrip((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId),
    }));
    await fetch(`/api/trips/${trip.id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
  };

  const saveSuitcase = async (payload: {
    suitcaseId?: string;
    name: string;
    size: string;
    assignee: string; // "shared" | userId
  }) => {
    const name = payload.name.trim();
    if (!name) {
      setAiMessage("Koffer-Name nötig");
      return;
    }
    const isShared = payload.assignee === "shared";
    const ownerUserId = isShared
      ? trip.ownerId || user.id
      : payload.assignee;
    const body = {
      name,
      size: payload.size,
      isShared,
      ownerUserId,
      ...(payload.suitcaseId ? { suitcaseId: payload.suitcaseId } : {}),
    };
    const res = await fetch(`/api/trips/${trip.id}/suitcases`, {
      method: payload.suitcaseId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAiMessage(
        typeof data.error === "string" ? data.error : "Koffer speichern fehlgeschlagen"
      );
      return;
    }
    const data = await res.json();
    setTrip({ ...data, aiInsights: normalizeInsights(data.aiInsights) });
  };

  const updateSuitcaseSize = async (suitcaseId: string, size: string) => {
    const bag = trip.suitcases.find((s) => s.id === suitcaseId);
    if (!bag) return;
    await saveSuitcase({
      suitcaseId,
      name: bag.name,
      size,
      assignee: bag.isShared ? "shared" : bag.ownerUserId || user.id,
    });
  };

  const addSuitcase = async () => {
    setBagForm({
      open: true,
      suitcaseId: null,
      name: `Koffer ${trip.suitcases.length + 1}`,
      size: "MEDIUM",
      assignee: user.id,
    });
  };

  const removeSuitcase = async (suitcaseId: string) => {
    const res = await fetch(
      `/api/trips/${trip.id}/suitcases?suitcaseId=${suitcaseId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      const data = await res.json();
      setTrip({ ...data, aiInsights: normalizeInsights(data.aiInsights) });
    }
  };

  const applyTripPayload = (
    data: Trip & {
      tips?: string[];
      guides?: AiInsights["guides"];
      added?: number;
      source?: string;
      error?: string;
    }
  ) => {
    const {
      tips,
      guides,
      added: _added,
      source: _source,
      error: _error,
      ...tripData
    } = data;
    if (tripData.aiInsights) {
      setTrip({
        ...tripData,
        aiInsights: normalizeInsights(tripData.aiInsights),
      });
      return;
    }
    setTrip((prev) => ({
      ...tripData,
      aiInsights: normalizeInsights({
        tips: Array.isArray(tips) && tips.length ? tips : prev.aiInsights?.tips || [],
        guides:
          Array.isArray(guides) && guides.length
            ? guides
            : prev.aiInsights?.guides || [],
        updatedAt: new Date().toISOString(),
      }),
    }));
  };

  const enrichWithAi = async () => {
    setAiBusy(true);
    setAiMessage(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/ai-enrich`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiMessage(
          typeof data.error === "string"
            ? data.error
            : `KI fehlgeschlagen (${res.status})`
        );
        return;
      }
      applyTripPayload(data);
      const base = data.added
        ? `${data.added} KI-Einträge ergänzt`
        : "Keine neuen KI-Einträge — Liste wirkt schon vollständig";
      setAiMessage(
        data.capacityNote ? `${base}. ${data.capacityNote}` : base
      );
    } catch (e) {
      setAiMessage(
        e instanceof Error ? e.message : "KI fehlgeschlagen (Netzwerk)"
      );
    } finally {
      setAiBusy(false);
    }
  };

  const regenerateInsights = async () => {
    setAiBusy(true);
    setAiMessage(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/ai-insights`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiMessage(
          typeof data.error === "string"
            ? data.error
            : `KI fehlgeschlagen (${res.status})`
        );
        return;
      }
      applyTripPayload(data);
      setAiMessage("Reisetipps aktualisiert");
    } catch (e) {
      setAiMessage(
        e instanceof Error ? e.message : "KI fehlgeschlagen (Netzwerk)"
      );
    } finally {
      setAiBusy(false);
    }
  };

  const startEditLeg = (leg: TripLeg) => {
    setEditingLegId(leg.id);
    setLegDraft({
      name: leg.name,
      location: leg.location || "",
      startDate: toDateInput(leg.startDate),
      endDate: toDateInput(leg.endDate),
      transport: (TRANSPORT_OPTIONS.some((t) => t.id === leg.transport)
        ? leg.transport
        : "OTHER") as Transport,
      laundryAvailable: leg.laundryAvailable,
    });
  };

  const saveLeg = async (): Promise<boolean> => {
    if (!editingLegId || !legDraft.name.trim()) return false;
    setLegBusy(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}/legs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legId: editingLegId,
          name: legDraft.name.trim(),
          location: legDraft.location.trim() || null,
          startDate: legDraft.startDate,
          endDate: legDraft.endDate,
          transport: legDraft.transport,
          laundryAvailable: legDraft.laundryAvailable,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAiMessage(
          typeof data.error === "string"
            ? data.error
            : "Etappe konnte nicht gespeichert werden"
        );
        return false;
      }
      const data = await res.json();
      setTrip({ ...data, aiInsights: normalizeInsights(data.aiInsights) });
      setEditingLegId(null);
      setAiMessage(
        "Etappe gespeichert. Unter Tipps «Nach Routenänderung neu berechnen» für Packliste, Zuweisung und Tipps."
      );
      return true;
    } finally {
      setLegBusy(false);
    }
  };

  const recalculateAfterRoute = async () => {
    setAiBusy(true);
    setAiMessage(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/ai-enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alsoInsights: true, rebalance: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiMessage(
          typeof data.error === "string"
            ? data.error
            : `KI fehlgeschlagen (${res.status})`
        );
        return;
      }
      applyTripPayload(data);
      const parts = [
        data.added ? `${data.added} Positionen ergänzt` : "Packliste geprüft",
        "Koffer neu zugewiesen",
        "Tipps aktualisiert",
      ];
      if (data.capacityNote) parts.push(String(data.capacityNote));
      setAiMessage(parts.join(" · "));
      setTab("ai");
    } catch (e) {
      setAiMessage(
        e instanceof Error ? e.message : "KI fehlgeschlagen (Netzwerk)"
      );
    } finally {
      setAiBusy(false);
    }
  };

  const deleteLeg = async (legId: string) => {
    if (trip.legs.length <= 1) return;
    setLegBusy(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}/legs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAiMessage(
          typeof data.error === "string"
            ? data.error
            : "Etappe konnte nicht gelöscht werden"
        );
        return;
      }
      const data = await res.json();
      setTrip({ ...data, aiInsights: normalizeInsights(data.aiInsights) });
      if (editingLegId === legId) setEditingLegId(null);
    } finally {
      setLegBusy(false);
    }
  };

  const participantOptions = useMemo(
    () => [
      ...trip.members.map((m) => ({
        key: m.user.id,
        label: m.user.name,
        color: m.user.color,
      })),
      sharedFilterOption(),
    ],
    [trip.members]
  );

  const filtered = useMemo(() => {
    return trip.items.filter((item) => {
      if (filter === "open" && item.packedAt) return false;
      if (filter === "packed" && !item.packedAt) return false;
      if (filter === "shared" && !item.isShared) return false;
      if (suitcaseFilter !== "all" && item.suitcaseId !== suitcaseFilter)
        return false;
      if (participantFilter.length > 0) {
        const owner = resolveItemOwner(item, trip);
        const key =
          owner.kind === "user" ? owner.user.id : "shared";
        if (!participantFilter.includes(key)) return false;
      }
      return true;
    });
  }, [trip.items, filter, suitcaseFilter, participantFilter, trip]);

  const sortItems = (a: PackItem, b: PackItem) => {
    const pa = priorityRank(resolvePriority(a));
    const pb = priorityRank(resolvePriority(b));
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "de");
  };

  const earlyItems = useMemo(
    () =>
      filtered
        .filter((i) => resolvePriority(i) === "EARLY")
        .sort(sortItems),
    [filtered]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, PackItem[]>();
    for (const item of filtered) {
      if (resolvePriority(item) === "EARLY") continue;
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return [...map.entries()].map(
      ([cat, items]) => [cat, [...items].sort(sortItems)] as const
    );
  }, [filtered]);

  const progress = useMemo(() => {
    const total = trip.items.length || 1;
    const packed = trip.items.filter((i) => i.packedAt).length;
    return Math.round((packed / total) * 100);
  }, [trip.items]);

  const tripOpenStats = useMemo(
    () => openStats(trip.items, trip),
    [trip]
  );

  const insights = normalizeInsights(trip.aiInsights);
  const hasInsights = insights.tips.length > 0 || insights.guides.length > 0;

  const copyEinladung = async () => {
    if (trip.inviteValid === false) {
      setAiMessage(trip.inviteInvalidReason || "Einladung ungültig");
      return;
    }
    const url = `${window.location.origin}/join?code=${trip.inviteCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const patchInvite = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/trips/${trip.id}/invite`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setAiMessage(data.error || "Einladung konnte nicht geändert werden");
      return;
    }
    setTrip({ ...data, aiInsights: normalizeInsights(data.aiInsights) });
    setAiMessage("Einladung aktualisiert");
  };

  const copyRouteShare = async () => {
    if (!trip.routeShareCode || trip.routeShareValid === false) {
      setAiMessage(
        trip.routeShareInvalidReason || "Zuerst Route-Code erzeugen"
      );
      return;
    }
    const url = `${window.location.origin}/create?route=${trip.routeShareCode}`;
    await navigator.clipboard.writeText(url);
    setRouteCopied(true);
    setTimeout(() => setRouteCopied(false), 2000);
  };

  const patchRouteShare = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/trips/${trip.id}/route-share`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setAiMessage(data.error || "Route-Teilen konnte nicht geändert werden");
      return;
    }
    setTrip({ ...data, aiInsights: normalizeInsights(data.aiInsights) });
    setAiMessage("Route-Teilen aktualisiert");
  };

  const isTripOwner =
    trip.ownerId === user.id ||
    trip.members.some((m) => m.user.id === user.id && m.role === "OWNER") ||
    user.role === "ADMIN";

  const removeMember = async (memberUserId: string) => {
    const member = trip.members.find((m) => m.user.id === memberUserId);
    const label = member?.user.name || "diese Person";
    if (
      !window.confirm(
        `${label} von dieser Reise entfernen? Die Person verliert den Zugang zur Packliste.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/trips/${trip.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: memberUserId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAiMessage(data.error || "Entfernen fehlgeschlagen");
      return;
    }
    setTrip({ ...data, aiInsights: normalizeInsights(data.aiInsights) });
    setAiMessage(`${label} entfernt`);
  };

  const canRemoveMember = (memberUserId: string) => {
    if (memberUserId === trip.ownerId) return false;
    if (isTripOwner) return true;
    return memberUserId === user.id;
  };

  const avatarPeopleForItem = (item: PackItem): MemberUser[] => {
    const owner = resolveItemOwner(item, trip);
    if (owner.kind === "shared" || item.isShared) {
      return trip.members.map((m) => m.user);
    }
    if (owner.kind === "user") return [owner.user];
    return [];
  };

  const renderAvatarStack = (people: MemberUser[], shared: boolean) => {
    if (people.length === 0) return null;
    const shown = people.slice(0, 4);
    const extra = people.length - shown.length;
    return (
      <div
        className="flex shrink-0 items-center justify-end pl-2"
        title={
          shared
            ? `Gemeinsam: ${people.map((p) => p.name).join(", ")}`
            : people[0]?.name
        }
      >
        <div className="flex items-center">
          {shown.map((person, i) => (
            <span
              key={person.id}
              className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full ring-2 ring-white"
              style={{
                marginLeft: i === 0 ? 0 : -8,
                zIndex: shown.length - i,
                background: person.color,
              }}
            >
              {person.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-bold text-white">
                  {person.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
          ))}
          {extra > 0 && (
            <span
              className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-stone-700 text-[10px] font-bold text-white ring-2 ring-white"
              style={{ marginLeft: -8, zIndex: 0 }}
            >
              +{extra}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderItem = (item: PackItem) => {
    const owner = resolveItemOwner(item, trip);
    const color =
      owner.kind === "shared"
        ? SHARED_COLOR
        : owner.kind === "user"
          ? owner.user.color
          : "#78716c";
    const people = avatarPeopleForItem(item);
    const priority = resolvePriority(item);
    const pLabel = priorityLabel(priority);

    return (
      <SwipeRow
        key={item.id}
        actions={[
          {
            id: "remove",
            label: "Entfernen",
            tone: "danger",
            onClick: () => removeItem(item.id),
          },
        ]}
      >
        <li
          className="card-surface flex list-none flex-col gap-2.5 border px-3.5 py-3.5 transition"
          style={tileStyle(color, Boolean(item.packedAt))}
        >
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              onClick={() => void togglePacked(item)}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                item.packedAt
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-stone-300/80 bg-white/70 text-transparent"
              )}
              aria-label={
                item.packedAt ? "Als offen markieren" : "Als gepackt markieren"
              }
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void togglePacked(item)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="text-card-title font-semibold text-stone-900">
                {item.quantity}× {item.name}
                {pLabel && (
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide",
                      priority === "EARLY"
                        ? "bg-sky-100/90 text-sky-900"
                        : "bg-stone-200/80 text-stone-700"
                    )}
                  >
                    {pLabel}
                  </span>
                )}
                {item.isShared && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
                    Gemeinsam
                  </span>
                )}
              </div>
              <div className="text-sm text-stone-500">
                {item.notes}
                {item.packedAt && item.packedBy && (
                  <span className="ml-1 font-medium text-teal-800">
                    · Gepackt von {item.packedBy.name}
                  </span>
                )}
              </div>
            </button>
          </div>
          <div className="flex items-end gap-2">
            <select
              data-no-swipe
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-base"
              value={item.suitcaseId || ""}
              onChange={(e) => moveSuitcase(item.id, e.target.value)}
            >
              {trip.suitcases.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (
                  {SUITCASE_SIZES.find((x) => x.id === s.size)?.label || s.size})
                </option>
              ))}
            </select>
            {renderAvatarStack(people, item.isShared || owner.kind === "shared")}
          </div>
        </li>
      </SwipeRow>
    );
  };

  const renderSection = (
    key: string,
    title: string,
    items: PackItem[],
    opts?: { icon?: "clock" | "briefcase"; hint?: string }
  ) => {
    const open = isSectionOpen(key);
    const stats = openStats(items, trip);
    const Icon = opts?.icon === "clock" ? Clock : Briefcase;
    const iconClass =
      opts?.icon === "clock" ? "text-sky-800" : "text-teal-800";

    return (
      <div key={key} className="card-surface-muted">
        <button
          type="button"
          onClick={() => toggleSection(key)}
          className="flex w-full items-start gap-2 px-3.5 py-3 text-left transition hover:bg-stone-50"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-stone-500" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-stone-500" />
          )}
          <Icon className={cn("mt-1 h-4 w-4 shrink-0", iconClass)} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-display text-card-title text-stone-900">{title}</span>
              <span className="text-sm text-stone-500">
                {stats.total} {stats.total === 1 ? "Item" : "Items"}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
              {stats.openTotal === 0 ? (
                <span className="font-medium text-teal-800">Alles erledigt</span>
              ) : (
                stats.buckets.map((b) => (
                  <span
                    key={b.key}
                    className="inline-flex items-center gap-1"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: b.color }}
                    />
                    {b.label}{" "}
                    <strong className="text-stone-800">{b.open}</strong> offen
                  </span>
                ))
              )}
            </div>
          </div>
        </button>
        {open && (
          <div className="border-t border-stone-100 px-3 pb-3 pt-2">
            {opts?.hint && (
              <p className="mb-2 text-xs text-stone-500">{opts.hint}</p>
            )}
            <ul className="space-y-2">{items.map(renderItem)}</ul>
          </div>
        )}
      </div>
    );
  };

  const tabs: { id: TripTab; label: string; icon: typeof ListChecks }[] = [
    { id: "pack", label: "Pack", icon: ListChecks },
    { id: "legs", label: "Route", icon: MapPinned },
    { id: "bags", label: "Koffer", icon: Luggage },
    { id: "ai", label: "Tipps", icon: Sparkles },
    { id: "people", label: "Team", icon: Users },
  ];

  const displayAvatarUrl = avatarPreviewUrl || user.avatarUrl || null;

  return (
    <div className="space-y-6 pb-28">
      <header className="card-surface space-y-3 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <BrandLogo className="mt-0.5 h-11 w-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow text-amber-800">FlexiPack-Reise</p>
            <h1 className="font-display text-page-title text-stone-950">
              {trip.title}
            </h1>
            <p className="mt-1 text-base text-stone-600">
              {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
              {trip.legs.length} Etappen · {progress}% gepackt
            </p>
          </div>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full rounded-full bg-teal-700 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          type="button"
          onClick={() => setHeaderDetails((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition",
              headerDetails ? "rotate-180" : ""
            )}
          />
          {headerDetails ? "Weniger Details" : "Einladung & offene Items"}
        </button>

        {headerDetails && (
          <div className="space-y-3 border-t border-stone-200/80 pt-3">
            <Button variant="outline" className="w-full sm:w-auto" onClick={copyEinladung}>
              <Share2 className="h-4 w-4" />
              {copied ? "Kopiert" : `Einladung ${trip.inviteCode}`}
            </Button>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-base text-stone-600">
              <span>
                <strong className="text-stone-900">{tripOpenStats.total}</strong>{" "}
                Items
              </span>
              {tripOpenStats.openTotal > 0 ? (
                <span className="flex flex-wrap items-center gap-2">
                  {tripOpenStats.buckets.map((b) => (
                    <span
                      key={b.key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-sm"
                      title={`${b.label}: ${b.open} offen`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: b.color }}
                      />
                      <span>
                        {b.label}{" "}
                        <strong className="text-stone-800">{b.open}</strong>
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="font-semibold text-teal-800">Alles erledigt</span>
              )}
            </div>
            {aiMessage && (
              <p className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-base text-teal-950">
                {aiMessage}
              </p>
            )}
          </div>
        )}

        {!headerDetails && aiMessage && (
          <p className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-base text-teal-950">
            {aiMessage}
          </p>
        )}
      </header>

      {activeTab === "pack" && (
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 px-4 py-5 text-teal-50 shadow-md">
            <ChecklistMotif className="absolute -right-1 bottom-0 h-24 w-36 opacity-40" />
            <p className="text-eyebrow text-teal-100/80">Packliste</p>
            <h2 className="mt-1 font-display text-section-title">Was noch fehlt?</h2>
            <p className="mt-1 max-w-[18rem] text-base text-teal-50/85">
              Filtern, abhaken, eigene Positionen ergänzen.
            </p>
          </div>

          <div className="card-surface space-y-3 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", "Alle"],
                  ["open", "Offen"],
                  ["packed", "Gepackt"],
                  ["shared", "Gemeinsam"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm font-semibold",
                    filter === id
                      ? "border-teal-800 bg-teal-800 text-white"
                      : "border-stone-200 bg-white text-stone-600"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-base"
                value={suitcaseFilter}
                onChange={(e) => setSuitcaseFilter(e.target.value)}
              >
                <option value="all">Alle Koffer</option>
                {trip.suitcases.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={enrichWithAi}
                disabled={aiBusy}
              >
                <Sparkles className="h-4 w-4" />
                {aiBusy ? "KI…" : "KI"}
              </Button>
            </div>
            <ParticipantFilter
              options={participantOptions}
              selected={participantFilter}
              onChange={setParticipantFilter}
            />
          </div>

          <AddPackItemForm
            tripId={trip.id}
            members={trip.members}
            existingCategories={trip.items.map((i) => i.category)}
            defaultAssigneeUserId={user.id}
            onCreated={(item) => {
              setTrip((prev) => {
                if (prev.items.some((i) => i.id === item.id)) return prev;
                return {
                  ...prev,
                  items: [
                    ...prev.items,
                    {
                      id: item.id,
                      name: item.name,
                      category: item.category,
                      quantity: item.quantity,
                      isShared: item.isShared,
                      notes: item.notes,
                      priority:
                        (item.priority as PackItem["priority"]) || "NORMAL",
                      source: item.source || "manual",
                      packedAt: item.packedAt ?? null,
                      packedByUserId: null,
                      packedBy: null,
                      suitcaseId: item.suitcaseId ?? null,
                      suitcase: (item.suitcase as PackItem["suitcase"]) ?? null,
                    },
                  ],
                };
              });
            }}
          />

          <div className="space-y-3">
            {earlyItems.length > 0 &&
              renderSection(
                EARLY_SECTION_KEY,
                "Rechtzeitig vorbereiten",
                earlyItems,
                {
                  icon: "clock",
                  hint: "Formulare, Visa und Co. — besser Tage oder Wochen vorher erledigen.",
                }
              )}
            {byCategory.map(([category, items]) =>
              renderSection(category, category, items, { icon: "briefcase" })
            )}
            {earlyItems.length === 0 && byCategory.length === 0 && (
              <div className="card-surface p-6 text-center">
                <ChecklistMotif className="mx-auto h-24 w-36 opacity-80" />
                <p className="mt-3 text-base text-stone-600">
                  Noch keine Positionen — mit «Position hinzufügen» starten oder
                  KI nutzen.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "legs" && (
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-amber-700 via-amber-600 to-teal-700 px-4 py-5 text-amber-50 shadow-md">
            <TravelMotif className="absolute -right-2 bottom-0 h-28 w-44 opacity-45" />
            <p className="text-eyebrow text-amber-100/85">Route</p>
            <h2 className="mt-1 font-display text-section-title">Etappen der Reise</h2>
            <p className="mt-1 max-w-[18rem] text-base text-amber-50/90">
              Orte, Transport und Wäsche — getrennt von der Packliste.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-section-title text-stone-900">Etappen</h3>
            <ul className="space-y-2">
              {trip.legs.map((leg) => {
                const actions = [
                  {
                    id: "edit",
                    label: "Ändern",
                    tone: "neutral" as const,
                    onClick: () => startEditLeg(leg),
                  },
                  ...(trip.legs.length > 1
                    ? [
                        {
                          id: "delete",
                          label: "Löschen",
                          tone: "danger" as const,
                          onClick: () => deleteLeg(leg.id),
                        },
                      ]
                    : []),
                ];
                return (
                  <SwipeRow key={leg.id} actions={actions}>
                    <li className="card-surface list-none bg-gradient-to-br from-teal-50 to-white px-4 py-3.5">
                      <div className="text-sm font-semibold uppercase tracking-wide text-teal-800">
                        {TRANSPORT_LABELS[leg.transport] || leg.transport}
                      </div>
                      <h4 className="mt-0.5 text-card-title font-semibold text-stone-900">
                        {leg.name}
                      </h4>
                      {leg.location && (
                        <p className="text-base text-stone-600">{leg.location}</p>
                      )}
                      <p className="mt-1 text-sm text-stone-500">
                        {formatDate(leg.startDate)} – {formatDate(leg.endDate)}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        Wäsche: {leg.laundryAvailable ? "Ja" : "Nein"}
                        {(leg.weatherTags || []).length > 0
                          ? ` · ${(leg.weatherTags || []).join(", ")}`
                          : ""}
                      </p>
                      <div className="mt-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => startEditLeg(leg)}
                        >
                          Datum & Destination ändern
                        </Button>
                      </div>
                    </li>
                  </SwipeRow>
                );
              })}
            </ul>

            {editingLegId && (
              <div className="card-surface p-4">
                <h4 className="font-display text-section-title text-stone-900">
                  Etappe ändern
                </h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="leg-name">Name</Label>
                    <Input
                      id="leg-name"
                      value={legDraft.name}
                      onChange={(e) =>
                        setLegDraft((d) => ({ ...d, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="leg-location">Ort / Region</Label>
                    <Input
                      id="leg-location"
                      value={legDraft.location}
                      onChange={(e) =>
                        setLegDraft((d) => ({ ...d, location: e.target.value }))
                      }
                      placeholder="z. B. Florida"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {LOCATION_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setLegDraft((d) => ({ ...d, location: preset }))
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                            legDraft.location === preset
                              ? "border-teal-700 bg-teal-50 text-teal-900"
                              : "border-stone-200 bg-stone-50 text-stone-600"
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Start</Label>
                    <DatePicker
                      value={legDraft.startDate}
                      onChange={(iso) =>
                        setLegDraft((d) => ({ ...d, startDate: iso }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Ende</Label>
                    <DatePicker
                      value={legDraft.endDate}
                      onChange={(iso) =>
                        setLegDraft((d) => ({ ...d, endDate: iso }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="leg-transport">Transport</Label>
                    <select
                      id="leg-transport"
                      className="mt-1 h-11 w-full rounded-xl border border-stone-300 bg-white/80 px-3 text-sm"
                      value={legDraft.transport}
                      onChange={(e) =>
                        setLegDraft((d) => ({
                          ...d,
                          transport: e.target.value as Transport,
                        }))
                      }
                    >
                      {TRANSPORT_OPTIONS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                      <input
                        type="checkbox"
                        checked={legDraft.laundryAvailable}
                        onChange={(e) =>
                          setLegDraft((d) => ({
                            ...d,
                            laundryAvailable: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-stone-300"
                      />
                      Wäsche verfügbar
                    </label>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={saveLeg} disabled={legBusy}>
                    {legBusy ? "Speichern…" : "Speichern"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingLegId(null)}
                    disabled={legBusy}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={legBusy || aiBusy}
                    onClick={() => {
                      void (async () => {
                        const ok = await saveLeg();
                        if (ok) await recalculateAfterRoute();
                      })();
                    }}
                  >
                    Speichern & KI neu berechnen
                  </Button>
                </div>
                <p className="mt-2 text-sm text-stone-500">
                  Speichern aktualisiert Daten/Destination. Mit KI werden Packliste,
                  Koffer-Zuweisung und Tipps an die neue Route angepasst.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "bags" && (
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 px-4 py-5 text-teal-50 shadow-md">
            <SuitcaseCardArt className="absolute -right-2 -top-1 h-24 w-36 opacity-50" />
            <p className="text-eyebrow text-teal-100/80">Übersicht</p>
            <h2 className="mt-1 font-display text-section-title">Was liegt wo?</h2>
            <p className="mt-1 max-w-[18rem] text-base text-teal-50/85">
              Name, Grösse und Zuweisung jederzeit ändern — tippe einen Koffer.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={addSuitcase}>
              Koffer hinzufügen
            </Button>
          </div>

          {bagForm.open && !bagForm.suitcaseId && (
            <form
              className="card-surface space-y-3 border-teal-200 p-4 ring-2 ring-teal-700/20"
              onSubmit={(e) => {
                e.preventDefault();
                void saveSuitcase({
                  suitcaseId: undefined,
                  name: bagForm.name,
                  size: bagForm.size,
                  assignee: bagForm.assignee,
                }).then(() =>
                  setBagForm((f) => ({ ...f, open: false, suitcaseId: null }))
                );
              }}
            >
              <p className="text-eyebrow text-teal-800">Neuer Koffer</p>
              <div>
                <Label htmlFor="bag-name-new">Bezeichnung</Label>
                <Input
                  id="bag-name-new"
                  value={bagForm.name}
                  onChange={(e) =>
                    setBagForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="z.B. Handgepäck / Gemeinsam"
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="bag-size-new">Grösse</Label>
                  <select
                    id="bag-size-new"
                    className="mt-1.5 flex h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base"
                    value={bagForm.size}
                    onChange={(e) =>
                      setBagForm((f) => ({ ...f, size: e.target.value }))
                    }
                  >
                    {SUITCASE_SIZES.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} — {opt.hint}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="bag-assignee-new">Zugewiesen an</Label>
                  <select
                    id="bag-assignee-new"
                    className="mt-1.5 flex h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base"
                    value={bagForm.assignee}
                    onChange={(e) =>
                      setBagForm((f) => ({ ...f, assignee: e.target.value }))
                    }
                  >
                    <option value="shared">Gemeinsam</option>
                    {trip.members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Hinzufügen</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setBagForm((f) => ({ ...f, open: false, suitcaseId: null }))
                  }
                >
                  Abbrechen
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {trip.suitcases.map((s, idx) => {
              const bagItems = trip.items.filter((i) => i.suitcaseId === s.id);
              const packed = bagItems.filter((i) => i.packedAt).length;
              const open = bagItems.length - packed;
              const pct =
                bagItems.length === 0
                  ? 0
                  : Math.round((packed / bagItems.length) * 100);
              const openKey = `bag-${s.id}`;
              const editingThis =
                bagForm.open && bagForm.suitcaseId === s.id;
              const expanded = isSectionOpen(openKey) || editingThis;
              const softMax =
                SUITCASE_SIZES.find((x) => x.id === s.size)?.softMaxItems ?? 40;
              const accent = s.isShared
                ? "#B45309"
                : s.owner?.color || "#0F766E";
              const overloaded = bagItems.length > softMax;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "card-surface overflow-hidden",
                    editingThis && "ring-2 ring-teal-700/30"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(openKey)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <SuitcaseCardArt
                      className="h-14 w-20 shrink-0"
                      accent={accent}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-lg text-stone-900">
                        {s.name}
                      </div>
                      <div className="text-sm text-stone-500">
                        {SUITCASE_SIZES.find((x) => x.id === s.size)?.label ||
                          s.size}
                        {s.isShared
                          ? " · Gemeinsam"
                          : s.owner
                            ? ` · ${s.owner.name}`
                            : ""}
                        {" · "}
                        {packed}/{bagItems.length} gepackt
                        {overloaded ? ` · knapp (~${softMax})` : ""}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: accent,
                          }}
                        />
                      </div>
                    </div>
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-stone-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-stone-400" />
                    )}
                  </button>
                  {expanded && (
                    <div className="space-y-3 border-t border-stone-100 px-3 pb-3 pt-3">
                      {editingThis ? (
                        <form
                          className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void saveSuitcase({
                              suitcaseId: s.id,
                              name: bagForm.name,
                              size: bagForm.size,
                              assignee: bagForm.assignee,
                            }).then(() =>
                              setBagForm((f) => ({
                                ...f,
                                open: false,
                                suitcaseId: null,
                              }))
                            );
                          }}
                        >
                          <p className="text-eyebrow text-teal-800">
                            Koffer bearbeiten
                          </p>
                          <div>
                            <Label htmlFor={`bag-name-${s.id}`}>
                              Bezeichnung
                            </Label>
                            <Input
                              id={`bag-name-${s.id}`}
                              value={bagForm.name}
                              onChange={(e) =>
                                setBagForm((f) => ({
                                  ...f,
                                  name: e.target.value,
                                }))
                              }
                              placeholder="z.B. Handgepäck / Gemeinsam"
                              required
                              autoFocus
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label htmlFor={`bag-size-${s.id}`}>Grösse</Label>
                              <select
                                id={`bag-size-${s.id}`}
                                className="mt-1.5 flex h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base"
                                value={bagForm.size}
                                onChange={(e) =>
                                  setBagForm((f) => ({
                                    ...f,
                                    size: e.target.value,
                                  }))
                                }
                              >
                                {SUITCASE_SIZES.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label} — {opt.hint}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label htmlFor={`bag-assignee-${s.id}`}>
                                Zugewiesen an
                              </Label>
                              <select
                                id={`bag-assignee-${s.id}`}
                                className="mt-1.5 flex h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base"
                                value={bagForm.assignee}
                                onChange={(e) =>
                                  setBagForm((f) => ({
                                    ...f,
                                    assignee: e.target.value,
                                  }))
                                }
                              >
                                <option value="shared">Gemeinsam</option>
                                {trip.members.map((m) => (
                                  <option key={m.user.id} value={m.user.id}>
                                    {m.user.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit">Speichern</Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setBagForm((f) => ({
                                  ...f,
                                  open: false,
                                  suitcaseId: null,
                                }))
                              }
                            >
                              Abbrechen
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setOpenSections((prev) => {
                                const next = { ...prev, [openKey]: true };
                                saveOpenSections(trip.id, next);
                                return next;
                              });
                              setBagForm({
                                open: true,
                                suitcaseId: s.id,
                                name: s.name,
                                size: s.size,
                                assignee: s.isShared
                                  ? "shared"
                                  : s.ownerUserId || user.id,
                              });
                            }}
                          >
                            Bezeichnung & Zuweisung
                          </Button>
                          {trip.suitcases.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-rose-700"
                              onClick={() => void removeSuitcase(s.id)}
                            >
                              Entfernen
                            </Button>
                          )}
                        </div>
                      )}
                      {bagItems.length === 0 ? (
                        <div className="py-4 text-center">
                          <ChecklistMotif className="mx-auto h-16 w-24 opacity-80" />
                          <p className="mt-1 text-sm text-stone-500">
                            Noch leer — weise Items in der Packliste zu.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-1.5">
                          {bagItems
                            .slice()
                            .sort((a, b) => {
                              if (Boolean(a.packedAt) !== Boolean(b.packedAt)) {
                                return a.packedAt ? 1 : -1;
                              }
                              return a.name.localeCompare(b.name, "de");
                            })
                            .map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => void togglePacked(item)}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm",
                                    item.packedAt
                                      ? "bg-teal-50/70 text-stone-500 line-through"
                                      : "bg-stone-50 text-stone-800"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                                      item.packedAt
                                        ? "border-teal-700 bg-teal-700 text-white"
                                        : "border-stone-300 bg-white text-transparent"
                                    )}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    {item.quantity}× {item.name}
                                    {open > 0 && !item.packedAt ? (
                                      <span className="ml-1 text-[10px] font-semibold uppercase text-amber-800">
                                        offen
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      )}
                      {idx === 0 && bagItems.length > 0 && !editingThis && (
                        <p className="text-xs text-stone-400">
                          Tippe eine Zeile, um gepackt/offen umzuschalten.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "ai" && (
        <section className="space-y-5">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-teal-900 via-teal-800 to-amber-700 px-4 py-5 text-teal-50 shadow-md">
            <TipsMotif className="absolute -right-1 bottom-0 h-28 w-40 opacity-50" />
            <p className="text-eyebrow text-teal-100/80">KI & Ratgeber</p>
            <h2 className="mt-1 font-display text-section-title">Tipps zur Reise</h2>
            <p className="mt-1 max-w-[18rem] text-base text-teal-50/85">
              Packliste verfeinern, Guides und Do&apos;s/Don&apos;ts — gespeichert
              auf dieser Reise.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={enrichWithAi} disabled={aiBusy}>
              <Sparkles className="h-4 w-4" />
              {aiBusy ? "KI denkt…" : "Liste mit KI verfeinern"}
            </Button>
            <Button
              variant="secondary"
              onClick={regenerateInsights}
              disabled={aiBusy}
            >
              <Sparkles className="h-4 w-4" />
              Reisetipps neu generieren
            </Button>
            <Button
              variant="outline"
              onClick={() => void recalculateAfterRoute()}
              disabled={aiBusy}
            >
              <Sparkles className="h-4 w-4" />
              Nach Routenänderung neu berechnen
            </Button>
          </div>
          <p className="text-sm text-stone-500">
            «Neu berechnen» ergänzt fehlende Positionen, weist Koffer nach Kapazität
            zu und aktualisiert die Reisetipps — z.B. nach geänderten Etappen.
          </p>

          {!hasInsights ? (
            <div className="card-surface p-6 text-center">
              <TipsMotif className="mx-auto mb-3 h-28 w-auto max-w-[240px] opacity-90" />
              <p className="font-medium text-stone-800">
                Noch keine AI-Infos gespeichert
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Verfeinere die Packliste oder generiere Reisetipps — sie bleiben
                auf dieser Reise gespeichert.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {insights.tips.length > 0 && (
                <div className="card-surface relative overflow-hidden p-4">
                  <TipsMotif className="pointer-events-none absolute -right-2 -top-1 h-20 w-28 opacity-25" />
                  <h3 className="relative font-display text-lg text-stone-900">
                    Tipps
                  </h3>
                  <ul className="relative mt-2 list-disc space-y-1.5 pl-5 text-sm text-stone-700">
                    {insights.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
              {insights.guides.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-display text-lg text-stone-900">Guides</h3>
                  {insights.guides.map((guide) => (
                    <article
                      key={`${guide.title}-${guide.body.slice(0, 24)}`}
                      className="card-surface px-4 py-3"
                    >
                      <h4 className="font-semibold text-stone-900">
                        {guide.title}
                      </h4>
                      {guide.body.split(/\n+/).map((para, idx) => (
                        <p
                          key={idx}
                          className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600"
                        >
                          {para}
                        </p>
                      ))}
                    </article>
                  ))}
                </div>
              )}
              {insights.updatedAt && (
                <p className="text-xs text-stone-400">
                  Aktualisiert: {formatDate(insights.updatedAt)}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "people" && (
        <section className="space-y-6">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-teal-800 via-teal-700 to-blue-800 px-4 py-5 text-teal-50 shadow-md">
            <TeamMotif className="absolute -right-1 bottom-0 h-28 w-40 opacity-50" />
            <p className="text-eyebrow text-teal-100/80">Gruppe</p>
            <h2 className="mt-1 font-display text-section-title">Team & Teilen</h2>
            <p className="mt-1 max-w-[18rem] text-base text-teal-50/85">
              Profil, Mitreisende, Pack-Einladung — und Route als Vorlage teilen.
            </p>
          </div>

          <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white/70 p-4 md:grid-cols-3">
            <div className="space-y-3">
              <div>
                <Label>Dein Name</Label>
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                />
              </div>
              <GenderPicker value={genderDraft} onChange={setGenderDraft} />
              <div>
                <Label>Avatar (freiwillig)</Label>
                <div className="mt-2 flex items-center gap-3">
                  {displayAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayAvatarUrl}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ background: user.color }}
                    >
                      {(nameDraft || user.name).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setPendingAvatar(file);
                        setAvatarMessage(
                          file
                            ? "Bild gewählt — tippe Speichern, damit es bleibt."
                            : null
                        );
                        e.target.value = "";
                      }}
                    />
                    {(displayAvatarUrl || pendingAvatar) && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        disabled={profileBusy}
                        className="text-xs font-medium text-rose-700 hover:underline disabled:opacity-50"
                      >
                        Avatar entfernen
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {avatarMessage && (
                <p
                  className={`text-sm font-medium ${
                    avatarMessage === "Profil gespeichert"
                      ? "text-teal-800"
                      : avatarMessage.includes("gewählt")
                        ? "text-amber-800"
                        : "text-rose-700"
                  }`}
                >
                  {avatarMessage}
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => void saveProfile()}
                disabled={profileBusy || !nameDraft.trim()}
              >
                {profileBusy ? "Speichern…" : "Speichern"}
              </Button>
              <p className="text-[11px] text-stone-500">
                Profil inkl. Avatar kannst du auch unter «Profil» in der
                unteren Navigation speichern.
              </p>
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Users className="h-3 w-3" /> Mitreisende
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {trip.members.map((m) => (
                  <span
                    key={m.id || m.user.id}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs"
                  >
                    {m.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.user.avatarUrl}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: m.user.color }}
                      />
                    )}
                    {m.user.name}
                    <span className="text-stone-400">
                      {m.user.id === trip.ownerId || m.role === "OWNER"
                        ? "Besitzer:in"
                        : m.role === "PARTNER"
                          ? "Mitreisende:r"
                          : m.role}
                    </span>
                    {canRemoveMember(m.user.id) && (
                      <button
                        type="button"
                        onClick={() => removeMember(m.user.id)}
                        className="ml-0.5 rounded-full p-0.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`${m.user.name} entfernen`}
                        title="Von der Reise entfernen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                ))}
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: SHARED_COLOR }}
                  />
                  Gemeinsam
                </span>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Überzählige Mitreisende mit × entfernen. Die Trip-Besitzer:in
                bleibt immer bestehen.
              </p>
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Einladung
              </Label>
              <p className="mt-2 text-sm text-stone-600">
                Code <strong>{trip.inviteCode}</strong>
                {trip.inviteExpiresAt && (
                  <>
                    {" "}
                    · gültig bis {formatDate(trip.inviteExpiresAt)}
                  </>
                )}
                {trip.inviteMaxUses != null && (
                  <>
                    {" "}
                    · {trip.inviteUseCount ?? 0}/{trip.inviteMaxUses}× genutzt
                  </>
                )}
              </p>
              {trip.inviteValid === false && (
                <p className="mt-1 text-sm text-rose-700">
                  {trip.inviteInvalidReason || "Einladung ungültig"}
                </p>
              )}
              <p className="mt-2 text-xs text-stone-500">
                Partner:in muss eingeloggt sein und den Code/Link verwenden.
                Alte Codes verfallen beim Erneuern. Das ist die{" "}
                <strong>gemeinsame Packliste</strong> — nicht die Route-Vorlage.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyEinladung}
                  disabled={trip.inviteValid === false}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {copied ? "Kopiert" : "Link kopieren"}
                </Button>
                {isTripOwner && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        patchInvite({ regenerate: true, singleUse: false })
                      }
                    >
                      Code erneuern
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        patchInvite({ regenerate: true, singleUse: true })
                      }
                    >
                      Einmal-Code
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => patchInvite({ extendDays: true })}
                    >
                      +30 Tage
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        patchInvite({
                          inviteEnabled: !(trip.inviteEnabled !== false),
                        })
                      }
                    >
                      {trip.inviteEnabled === false
                        ? "Einladung aktivieren"
                        : "Einladung pausieren"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-1">
                <MapPinned className="h-3 w-3" /> Route teilen
              </Label>
              <p className="mt-2 text-sm text-stone-600">
                Andere Gruppen starten damit eine{" "}
                <strong>eigene Reise</strong> mit denselben Etappen — ohne
                deine Packliste, Koffer oder Tipps.
              </p>
              {trip.routeShareCode ? (
                <p className="mt-2 text-sm text-stone-600">
                  Code <strong>{trip.routeShareCode}</strong>
                  {trip.routeShareExpiresAt && (
                    <>
                      {" "}
                      · gültig bis {formatDate(trip.routeShareExpiresAt)}
                    </>
                  )}
                  {trip.routeShareMaxUses != null && (
                    <>
                      {" "}
                      · {trip.routeShareUseCount ?? 0}/
                      {trip.routeShareMaxUses}× genutzt
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
                    onClick={copyRouteShare}
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
                        patchRouteShare({
                          regenerate: true,
                          singleUse: false,
                        })
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
                        patchRouteShare({
                          regenerate: true,
                          singleUse: true,
                        })
                      }
                    >
                      Einmal-Route
                    </Button>
                    {trip.routeShareCode && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            patchRouteShare({ extendDays: true })
                          }
                        >
                          +30 Tage
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            patchRouteShare({
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
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-stone-900">Koffer</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addSuitcase}
              >
                Koffer hinzufügen
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {trip.suitcases.map((s) => {
                const count = trip.items.filter(
                  (i) => i.suitcaseId === s.id
                ).length;
                const packed = trip.items.filter(
                  (i) => i.suitcaseId === s.id && i.packedAt
                ).length;
                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-stone-200 bg-white/80 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <Luggage className="mt-0.5 h-5 w-5 text-teal-800" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{s.name}</div>
                        <div className="text-xs text-stone-500">
                          {packed}/{count} Einträge
                          {s.isShared ? " · Gemeinsam" : ""}
                        </div>
                        <select
                          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-2 py-2 text-sm"
                          value={s.size}
                          onChange={(e) =>
                            void updateSuitcaseSize(s.id, e.target.value)
                          }
                        >
                          {SUITCASE_SIZES.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label} — {opt.hint}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="mt-2"
                          onClick={() => {
                            const openKey = `bag-${s.id}`;
                            setTab("bags");
                            setOpenSections((prev) => {
                              const next = { ...prev, [openKey]: true };
                              saveOpenSections(trip.id, next);
                              return next;
                            });
                            setBagForm({
                              open: true,
                              suitcaseId: s.id,
                              name: s.name,
                              size: s.size,
                              assignee: s.isShared
                                ? "shared"
                                : s.ownerUserId || user.id,
                            });
                          }}
                        >
                          Name & Zuweisung
                        </Button>
                      </div>
                      {trip.suitcases.length > 1 && (
                        <button
                          type="button"
                          className="text-sm text-rose-600"
                          onClick={() => void removeSuitcase(s.id)}
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-teal-900/10 bg-[#FBF7F0]/95 backdrop-blur-md"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Reise-Bereiche"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-0.5 pt-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold transition",
                  active
                    ? "text-teal-800"
                    : "text-stone-500 hover:text-stone-800"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-2xl transition",
                    active
                      ? "bg-teal-800 text-white shadow-md shadow-teal-900/20"
                      : "bg-transparent"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
