"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Users,
  Luggage,
  MapPinned,
  Share2,
  Sparkles,
  Bot,
  ChevronLeft,
  Clock,
  ListChecks,
  Printer,
  CloudSun,
  Layers2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { SwipeRow } from "@/components/ui/swipe-row";
import { TravelMotif, SuitcaseCardArt, ChecklistMotif, TipsMotif } from "@/components/app/travel-motif";
import { BrandLogo } from "@/components/app/brand-logo";
import {
  DockItem,
  FloatingDock,
  SideButton,
  SideLink,
  SideNav,
  SideSection,
} from "@/components/app/floating-dock";
import { Track } from "@/components/ui/glass";
import { Segment, Segmented } from "@/components/ui/segmented";
import { AddPackItemForm } from "@/components/trip/add-pack-item-form";
import { ItemIllustration } from "@/components/trip/item-illustration";
import { PackAgentPanel } from "@/components/trip/pack-agent-panel";
import { PackProgressCard } from "@/components/trip/pack-progress-card";
import { TripTeamPanel } from "@/components/trip/trip-team-panel";
import {
  ParticipantFilter,
  sharedFilterOption,
  unassignedFilterOption,
} from "@/components/trip/participant-filter";
import { resolvePackOwnerId } from "@/lib/pack-ownership";
import { cn, formatDate } from "@/lib/utils";
import type { PackGender, Transport, WeatherTag } from "@/lib/types";
import { SUITCASE_SIZES } from "@/lib/suitcases";
import { SHARED_COLOR, tileStyle } from "@/lib/colors";
import { LOCATION_PRESETS } from "@/lib/locations";
import { WEATHER_TAG_LABELS } from "@/lib/weather";
import {
  priorityLabel,
  priorityRank,
  resolvePriority,
  type PackPriority,
} from "@/lib/priority";
import { findDuplicateGroups, type CleanupItem } from "@/lib/pack-cleanup";
import {
  applyOutboxToItems,
  enqueuePackToggle,
  flushPackOutbox,
  isBrowserOnline,
  listOutbox,
  loadTripSnapshot,
  pendingCount,
  removeOutboxEntry,
  saveTripSnapshot,
} from "@/lib/offline-pack";

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
  ownerUserId?: string | null;
  suitcaseId: string | null;
  photoUrl?: string | null;
  packedBy?: MemberUser | null;
  owner?: MemberUser | null;
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
  weatherSummary?: {
    label: string;
    tMin: number | null;
    tMax: number | null;
    rainMm: number | null;
    fetchedAt: string;
  } | null;
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

/** Glass form control — matches Input/Textarea so selects don't stand out. */
const selectClass =
  "glass glass-thin min-w-0 rounded-[var(--r-sm)] px-3 py-2.5 text-base text-foreground backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const fieldClass =
  "glass glass-thin mt-1.5 flex h-12 w-full rounded-[var(--r-md)] px-3 text-base text-foreground backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  const resolved = resolvePackOwnerId(item, {
    members: trip.members.map((m) => ({ id: m.user.id, name: m.user.name })),
    suitcases: trip.suitcases,
  });
  if (resolved.kind === "shared") return { kind: "shared" };
  if (resolved.kind === "user") {
    const u =
      trip.members.find((m) => m.user.id === resolved.userId)?.user ||
      (item.owner?.id === resolved.userId ? item.owner : null);
    if (u) return { kind: "user", user: u };
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
const DAY_OF_SECTION_KEY = "__day_of__";

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
  const router = useRouter();
  const [trip, setTrip] = useState<Trip>(() => ({
    ...initialTrip,
    aiInsights: normalizeInsights(initialTrip.aiInsights),
  }));
  const [user, setUser] = useState<SessionUserProp>(sessionUser);
  const [filter, setFilter] = useState<"all" | "open" | "packed" | "shared">(
    "all"
  );
  const [suitcaseFilter, setSuitcaseFilter] = useState<string>("all");
  const [participantFilter, setParticipantFilter] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [routeCopied, setRouteCopied] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
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
    weatherTags: [] as WeatherTag[],
  });
  const [legBusy, setLegBusy] = useState(false);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetId = useRef<string | null>(null);
  const flushingRef = useRef(false);

  useEffect(() => {
    setUser(sessionUser);
  }, [sessionUser]);

  useEffect(() => {
    setOpenSections(loadOpenSections(trip.id));
    setActiveTab(loadTab(trip.id));
  }, [trip.id]);

  const refreshPending = useCallback(async (tripId: string) => {
    const n = await pendingCount(tripId);
    setPendingSync(n);
  }, []);

  const flushAndRefresh = useCallback(async (tripId: string) => {
    if (flushingRef.current || !isBrowserOnline()) return;
    flushingRef.current = true;
    try {
      await flushPackOutbox(tripId);
      await refreshPending(tripId);
      if (!isBrowserOnline()) return;
      const res = await fetch(`/api/trips/${tripId}`, {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = (await res.json()) as Trip;
        setTrip({
          ...data,
          aiInsights: normalizeInsights(data.aiInsights),
        });
      }
    } finally {
      flushingRef.current = false;
      await refreshPending(tripId);
    }
  }, [refreshPending]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const online = isBrowserOnline();
      if (!cancelled) setIsOnline(online);

      if (!online) {
        const snap = await loadTripSnapshot<Trip>(trip.id);
        if (cancelled || !snap) {
          await refreshPending(trip.id);
          return;
        }
        const outbox = await listOutbox(trip.id);
        setTrip({
          ...snap,
          items: applyOutboxToItems(snap.items || [], outbox),
          aiInsights: normalizeInsights(snap.aiInsights),
        });
      } else {
        await flushAndRefresh(trip.id);
      }
      if (!cancelled) await refreshPending(trip.id);
    };

    void boot();

    const onOnline = () => {
      setIsOnline(true);
      void flushAndRefresh(trip.id);
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [trip.id, flushAndRefresh, refreshPending]);

  useEffect(() => {
    void saveTripSnapshot(trip.id, trip);
  }, [trip]);

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

  const togglePacked = useCallback(
    async (item: PackItem) => {
      if (!user?.id) return;
      const packed = !item.packedAt;

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

      const queueOffline = async () => {
        try {
          await enqueuePackToggle({
            tripId: trip.id,
            itemId: item.id,
            packed,
          });
          await refreshPending(trip.id);
        } catch {
          // keep optimistic UI even if outbox write fails
        }
      };

      if (!isBrowserOnline()) {
        await queueOffline();
        return;
      }

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
        await removeOutboxEntry(`${trip.id}:${item.id}`);
        await refreshPending(trip.id);
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
        await queueOffline();
      }
    },
    [trip.id, user, refreshPending]
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

  const assignOwner = async (itemId: string, assignee: string) => {
    const isShared = assignee === "shared";
    const ownerUserId =
      isShared || assignee === "unassigned" ? null : assignee;
    const ownerUser = ownerUserId
      ? trip.members.find((m) => m.user.id === ownerUserId)?.user || null
      : null;
    setTrip((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              isShared,
              ownerUserId,
              owner: ownerUser,
            }
          : i
      ),
    }));
    await fetch(`/api/trips/${trip.id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        isShared,
        ownerUserId,
      }),
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

  const cleanupDuplicates = async () => {
    setCleanupBusy(true);
    setAiMessage(null);
    try {
      const res = await fetch(
        `/api/trips/${trip.id}/items/cleanup-duplicates`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiMessage(
          typeof data.error === "string"
            ? data.error
            : "Aufräumen fehlgeschlagen"
        );
        return;
      }
      setTrip({ ...data, aiInsights: normalizeInsights(data.aiInsights) });
      setAiMessage(
        typeof data.message === "string"
          ? data.message
          : "Duplikate zusammengeführt"
      );
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : "Aufräumen fehlgeschlagen");
    } finally {
      setCleanupBusy(false);
    }
  };

  const pickItemPhoto = (itemId: string) => {
    photoTargetId.current = itemId;
    photoInputRef.current?.click();
  };

  const onItemPhotoSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    const itemId = photoTargetId.current;
    e.target.value = "";
    if (!file || !itemId) return;
    setPhotoBusyId(itemId);
    setAiMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("itemId", itemId);
      const res = await fetch(`/api/trips/${trip.id}/items/photo`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiMessage(
          typeof data.error === "string" ? data.error : "Foto fehlgeschlagen"
        );
        return;
      }
      if (data.trip) {
        setTrip({
          ...data.trip,
          aiInsights: normalizeInsights(data.trip.aiInsights),
        });
      } else if (data.item) {
        setTrip((prev) => ({
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId ? { ...i, photoUrl: data.item.photoUrl } : i
          ),
        }));
      }
    } catch (err) {
      setAiMessage(err instanceof Error ? err.message : "Foto fehlgeschlagen");
    } finally {
      setPhotoBusyId(null);
      photoTargetId.current = null;
    }
  };

  const removeItemPhoto = async (itemId: string) => {
    setPhotoBusyId(itemId);
    try {
      const res = await fetch(`/api/trips/${trip.id}/items/photo`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAiMessage(
          typeof data.error === "string" ? data.error : "Foto löschen fehlgeschlagen"
        );
        return;
      }
      setTrip((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId ? { ...i, photoUrl: null } : i
        ),
      }));
    } finally {
      setPhotoBusyId(null);
    }
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
      weatherTags: (leg.weatherTags || []).filter((t): t is WeatherTag =>
        t in WEATHER_TAG_LABELS
      ),
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
          weatherTags: legDraft.weatherTags,
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

  const loadWeather = async (legId?: string) => {
    setWeatherBusy(true);
    setAiMessage(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/weather`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(legId ? { legId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiMessage(
          typeof data.error === "string" ? data.error : "Wetter fehlgeschlagen"
        );
        return;
      }
      setTrip({ ...data, aiInsights: normalizeInsights(data.aiInsights) });
      setAiMessage(
        typeof data.message === "string"
          ? data.message
          : "Wetter aktualisiert"
      );
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : "Wetter fehlgeschlagen");
    } finally {
      setWeatherBusy(false);
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
      unassignedFilterOption(),
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
          owner.kind === "user"
            ? owner.user.id
            : owner.kind === "shared"
              ? "shared"
              : "personal";
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

  const ownerGroups = useMemo(() => {
    const groups: {
      key: string;
      label: string;
      color: string;
      items: PackItem[];
    }[] = [];
    const index = new Map<string, number>();
    const add = (key: string, label: string, color: string) => {
      index.set(key, groups.length);
      groups.push({ key, label, color, items: [] });
    };
    const self = trip.members.find((m) => m.user.id === user.id);
    if (self) {
      add(
        self.user.id,
        trip.members.length > 1 ? `${self.user.name} (ich)` : self.user.name,
        self.user.color
      );
    }
    for (const m of trip.members) {
      if (m.user.id === user.id) continue;
      add(m.user.id, m.user.name, m.user.color);
    }
    add("shared", "Gemeinsam", SHARED_COLOR);
    add("personal", "Ohne Zuweisung", "#78716c");

    for (const item of filtered) {
      const owner = resolveItemOwner(item, trip);
      const key =
        owner.kind === "user"
          ? owner.user.id
          : owner.kind === "shared"
            ? "shared"
            : "personal";
      let i = index.get(key);
      if (i == null) {
        add(key, owner.kind === "user" ? owner.user.name : key, "#78716c");
        i = index.get(key)!;
      }
      groups[i].items.push(item);
    }

    return groups.filter((g) => g.items.length > 0);
  }, [filtered, trip, user.id]);

  const duplicatePreview = useMemo(() => {
    const cleanupItems: CleanupItem[] = trip.items.map((i) => {
      const owner = resolveItemOwner(i, trip);
      const ownerId =
        owner.kind === "user" ? owner.user.id : null;
      return {
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        isShared: i.isShared,
        notes: i.notes,
        priority: (i.priority || "NORMAL") as PackPriority,
        packedAt: i.packedAt,
        photoUrl: i.photoUrl,
        ownerUserId: ownerId,
        assigneeKey: i.isShared ? "shared" : ownerId || undefined,
      };
    });
    const groups = findDuplicateGroups(cleanupItems);
    return {
      groupCount: groups.length,
      removedCount: groups.reduce((n, g) => n + g.loserIds.length, 0),
    };
  }, [trip.items, trip.members, trip.suitcases]);

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

  const removeTripOrLeave = async () => {
    const ok = window.confirm(
      isTripOwner
        ? `Reise «${trip.title}» wirklich löschen? Das kann nicht rückgängig gemacht werden.`
        : `Reise «${trip.title}» verlassen?`
    );
    if (!ok) return;
    setAiMessage(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiMessage(
          typeof data.error === "string"
            ? data.error
            : "Löschen fehlgeschlagen"
        );
        return;
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
    }
  };

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
              className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full ring-2 ring-[rgba(255,255,255,0.65)] dark:ring-[rgba(255,255,255,0.14)]"
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
              className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--teal-900)] text-[10px] font-bold text-white ring-2 ring-[rgba(255,255,255,0.65)] dark:ring-[rgba(255,255,255,0.14)]"
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
            id: "photo",
            label: item.photoUrl ? "Foto ersetzen" : "Foto",
            tone: "neutral",
            onClick: () => pickItemPhoto(item.id),
          },
          ...(item.photoUrl
            ? [
                {
                  id: "photo-del",
                  label: "Foto weg",
                  tone: "neutral" as const,
                  onClick: () => void removeItemPhoto(item.id),
                },
              ]
            : []),
          {
            id: "remove",
            label: "Entfernen",
            tone: "danger",
            onClick: () => removeItem(item.id),
          },
        ]}
      >
        <li
          className="glass flex list-none flex-col gap-2.5 rounded-[var(--r-md)] px-3 py-3 transition"
          style={tileStyle(color, Boolean(item.packedAt))}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <button
              type="button"
              onClick={() => void togglePacked(item)}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-sm)] transition active:scale-[0.92]",
                item.packedAt
                  ? "bg-[linear-gradient(160deg,var(--teal-600),var(--teal-800))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.40),0_2px_8px_rgba(15,118,110,0.35)]"
                  : "glass glass-thin text-transparent shadow-[inset_0_1px_0_var(--rim-top),inset_0_0_0_1.5px_var(--edge-strong)]"
              )}
              aria-label={
                item.packedAt ? "Als offen markieren" : "Als gepackt markieren"
              }
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-no-swipe
              onClick={() => pickItemPhoto(item.id)}
              disabled={photoBusyId === item.id}
              className="glass glass-thin relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--r-sm)]"
              aria-label={item.photoUrl ? "Foto ändern" : "Eigenes Foto hinzufügen"}
              title={item.photoUrl ? "Foto ändern" : "Eigenes Foto hinzufügen"}
            >
              <ItemIllustration
                name={item.name}
                category={item.category}
                photoUrl={item.photoUrl}
              />
            </button>
            <button
              type="button"
              onClick={() => void togglePacked(item)}
              className="min-w-0 flex-1 text-left"
            >
              <div
                className={cn(
                  "text-card-title font-semibold text-foreground",
                  item.packedAt && "line-through opacity-55"
                )}
              >
                {item.quantity}× {item.name}
                {pLabel && (
                  <Badge
                    variant={
                      priority === "EARLY"
                        ? "info"
                        : priority === "DAY_OF"
                          ? "warning"
                          : "muted"
                    }
                    className="ml-2 align-middle"
                  >
                    {pLabel}
                  </Badge>
                )}
                {owner.kind === "shared" || item.isShared ? (
                  <Badge variant="warning" className="ml-2 align-middle">
                    Gemeinsam
                  </Badge>
                ) : owner.kind === "user" ? (
                  <Badge variant="outline" className="ml-2 align-middle">
                    {owner.user.name}
                  </Badge>
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground">
                {item.notes}
                {item.packedAt && item.packedBy && (
                  <span className="ml-1 font-medium text-primary">
                    · Gepackt von {item.packedBy.name}
                  </span>
                )}
              </div>
            </button>
          </div>
          <div className="flex items-end gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                data-no-swipe
                aria-label="Zugewiesen an"
                className={selectClass}
                value={
                  owner.kind === "shared"
                    ? "shared"
                    : owner.kind === "user"
                      ? owner.user.id
                      : "unassigned"
                }
                onChange={(e) => void assignOwner(item.id, e.target.value)}
              >
                {trip.members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
                <option value="shared">Gemeinsam</option>
                <option value="unassigned">Ohne Zuweisung</option>
              </select>
              <select
                data-no-swipe
                aria-label="Koffer"
                className={selectClass}
                value={item.suitcaseId || ""}
                onChange={(e) => moveSuitcase(item.id, e.target.value)}
              >
                {trip.suitcases.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (
                    {SUITCASE_SIZES.find((x) => x.id === s.size)?.label ||
                      s.size}
                    )
                  </option>
                ))}
              </select>
            </div>
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
    opts?: {
      icon?: "clock" | "briefcase";
      hint?: string;
      motif?: "day";
      tint?: "amber" | "teal";
    }
  ) => {
    const open = isSectionOpen(key);
    const stats = openStats(items, trip);
    const Icon = opts?.icon === "clock" ? Clock : Briefcase;
    const iconClass =
      opts?.icon === "clock"
        ? "text-[var(--amber-700)] dark:text-[#fbbf24]"
        : "text-primary";

    return (
      <div
        key={key}
        className={cn(
          "glass relative overflow-hidden rounded-[var(--r-lg)] p-1.5",
          opts?.tint === "amber" && "tint-amber",
          opts?.tint === "teal" && "tint-teal"
        )}
      >
        {opts?.motif === "day" && (
          <ChecklistMotif className="pointer-events-none absolute -right-2 top-0 h-16 w-24 opacity-20" />
        )}
        <button
          type="button"
          onClick={() => toggleSection(key)}
          className="relative flex w-full items-start gap-2.5 rounded-[var(--r-md)] px-2.5 py-2.5 text-left transition active:scale-[0.99]"
          aria-expanded={open}
        >
          <span className="glass glass-thin mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <Icon className={cn("h-4 w-4", iconClass)} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-display text-card-title text-foreground">
                {title}
              </span>
              <span className="text-sm text-muted-foreground">
                {stats.total} {stats.total === 1 ? "Item" : "Items"}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {stats.openTotal === 0 ? (
                <span className="font-semibold text-primary">Alles erledigt</span>
              ) : (
                stats.buckets.map((b) => (
                  <span key={b.key} className="inline-flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: b.color }}
                    />
                    {b.label}{" "}
                    <strong className="text-foreground">{b.open}</strong> offen
                  </span>
                ))
              )}
            </div>
          </div>
          {open ? (
            <ChevronDown className="mt-2 h-4 w-4 shrink-0 text-subtle" />
          ) : (
            <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-subtle" />
          )}
        </button>
        {open && (
          <div className="relative px-1 pb-1 pt-1">
            {opts?.hint && (
              <p className="mb-2 px-1.5 text-xs text-muted-foreground">
                {opts.hint}
              </p>
            )}
            <ul className="space-y-1.5">{items.map(renderItem)}</ul>
          </div>
        )}
      </div>
    );
  };

  const tabs: {
    id: TripTab;
    label: string;
    sideLabel?: string;
    icon: typeof ListChecks;
    count?: number;
  }[] = [
    {
      id: "pack",
      label: "Pack",
      sideLabel: "Packliste",
      icon: ListChecks,
      count: tripOpenStats.openTotal,
    },
    { id: "legs", label: "Route", icon: MapPinned, count: trip.legs.length },
    { id: "bags", label: "Koffer", icon: Luggage, count: trip.suitcases.length },
    { id: "ai", label: "Tipps", sideLabel: "Tipps & KI", icon: Sparkles },
    { id: "people", label: "Team", icon: Users, count: trip.members.length },
  ];

  const viewingOnePerson = participantFilter.length === 1;
  const selfGroup = ownerGroups.find((g) => g.key === user.id);
  const otherGroups = ownerGroups.filter(
    (g) => g.key !== user.id && g.key !== "shared" && g.key !== "personal"
  );
  const sharedGroups = ownerGroups.filter(
    (g) => g.key === "shared" || g.key === "personal"
  );

  const renderOwnerGroup = (
    group: (typeof ownerGroups)[number]
  ) => {
    const early = group.items
      .filter((i) => resolvePriority(i) === "EARLY")
      .sort(sortItems);
    const dayOf = group.items
      .filter((i) => resolvePriority(i) === "DAY_OF")
      .sort(sortItems);
    const cats = new Map<string, PackItem[]>();
    for (const item of group.items) {
      const p = resolvePriority(item);
      if (p === "EARLY" || p === "DAY_OF") continue;
      if (!cats.has(item.category)) cats.set(item.category, []);
      cats.get(item.category)!.push(item);
    }
    const open = group.items.filter((i) => !i.packedAt).length;
    const personKey = `person:${group.key}`;
    const personOpen = viewingOnePerson || isSectionOpen(personKey);
    return (
      <section
        key={group.key}
        id={`pack-person-${group.key}`}
        className="space-y-3"
        aria-label={group.label}
      >
        <button
          type="button"
          onClick={() => {
            if (viewingOnePerson) return;
            toggleSection(personKey);
          }}
          className="glass glass-thick sticky top-2 z-10 flex min-h-12 w-full items-center gap-2.5 rounded-full px-2.5 py-2 text-left"
          aria-expanded={personOpen}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-[rgba(255,255,255,0.65)] dark:ring-[rgba(255,255,255,0.14)]"
            style={{ background: group.color }}
            aria-hidden
          >
            {group.label.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-card-title text-foreground">
              {group.label}
            </span>
            <span className="block text-xs text-muted-foreground">
              {open} offen · {group.items.length} Positionen
            </span>
          </span>
          {!viewingOnePerson &&
            (personOpen ? (
              <ChevronDown className="mr-1 h-4 w-4 shrink-0 text-subtle" />
            ) : (
              <ChevronRight className="mr-1 h-4 w-4 shrink-0 text-subtle" />
            ))}
        </button>
        {personOpen && (
          <>
            {early.length > 0 &&
              renderSection(
                `${group.key}:${EARLY_SECTION_KEY}`,
                "Rechtzeitig vorbereiten",
                early,
                {
                  icon: "clock",
                  tint: "teal",
                  hint: "Formulare, Visa und Co. — besser Tage oder Wochen vorher.",
                }
              )}
            {[...cats.entries()].map(([category, items]) =>
              renderSection(
                `${group.key}:${category}`,
                category,
                [...items].sort(sortItems),
                { icon: "briefcase" }
              )
            )}
            {dayOf.length > 0 &&
              renderSection(
                `${group.key}:${DAY_OF_SECTION_KEY}`,
                "Am Reisetag",
                dayOf,
                {
                  icon: "clock",
                  motif: "day",
                  tint: "amber",
                  hint: "Bordkarte, Schlüssel, Geldbörse — kurz vor dem Losfahren abhaken.",
                }
              )}
          </>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-5 pb-28 pad:pb-8">
      {/* iPad / desktop: the trip owns the sidebar while you are inside it. */}
      <SideNav label="Reise-Bereiche">
        <Link
          href="/"
          className="mb-2 flex items-center gap-2.5 rounded-[var(--r-md)] px-3.5 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          Alle Reisen
        </Link>

        <div className="glass mx-1 mb-3 rounded-[var(--r-lg)] p-3.5">
          <p className="text-eyebrow text-subtle">Aktuelle Reise</p>
          <p className="mt-1.5 font-display text-card-title leading-tight text-foreground">
            {trip.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
          </p>
          <div className="mt-3 flex items-center gap-2.5">
            <Track pct={progress} slim className="flex-1" />
            <span className="shrink-0 text-xs font-bold text-subtle">
              {progress} %
            </span>
          </div>
        </div>

        <SideSection>Bereiche</SideSection>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <SideButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setTab(tab.id)}
              icon={<Icon className="size-5 shrink-0" />}
              count={tab.count}
            >
              {tab.sideLabel ?? tab.label}
            </SideButton>
          );
        })}

        {ownerGroups.length > 0 && (
          <>
            <SideSection>Personen</SideSection>
            {ownerGroups.map((group) => {
              const openCount = group.items.filter((i) => !i.packedAt).length;
              const only =
                participantFilter.length === 1 &&
                participantFilter[0] === group.key;
              return (
                <SideButton
                  key={group.key}
                  active={only}
                  onClick={() => {
                    setTab("pack");
                    setParticipantFilter(only ? [] : [group.key]);
                  }}
                  icon={
                    <span
                      className="h-5 w-5 shrink-0 rounded-full ring-2 ring-[rgba(255,255,255,0.55)] dark:ring-[rgba(255,255,255,0.12)]"
                      style={{ background: group.color }}
                      aria-hidden
                    />
                  }
                  count={openCount > 0 ? `${openCount} offen` : "fertig"}
                >
                  {group.label}
                </SideButton>
              );
            })}
          </>
        )}

        <div className="mt-auto pt-3">
          <SideLink
            href={`/trip/${trip.id}/print`}
            icon={<Printer className="size-5 shrink-0" />}
          >
            Liste drucken
          </SideLink>
        </div>
      </SideNav>

      <header className="glass space-y-3 rounded-[var(--r-lg)] p-4 md:p-5">
        <div className="flex items-start gap-3">
          <Link href="/" className="pad:hidden" aria-label="Zurück zu den Reisen">
            <span className="glass glass-thick mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </span>
          </Link>
          <BrandLogo className="mt-0.5 hidden h-11 w-11 shrink-0 pad:block" />
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow text-[var(--amber-700)] dark:text-[#fbbf24]">
              FlexiPack-Reise
            </p>
            <h1 className="font-display text-page-title text-foreground">
              {trip.title}
            </h1>
            <p className="mt-1 text-base text-muted-foreground">
              {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
              {trip.legs.length} Etappen · {progress}% gepackt
            </p>
          </div>
        </div>

        <Track pct={progress} />

        <div className="flex flex-wrap gap-2 pad:hidden">
          <Link href={`/trip/${trip.id}/print`}>
            <Button type="button" variant="secondary" size="sm">
              <Printer className="h-3.5 w-3.5" />
              Liste drucken
            </Button>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setHeaderDetails((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
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
          <div className="space-y-3 border-t border-[var(--edge)] pt-3">
            <Button variant="outline" className="w-full sm:w-auto" onClick={copyEinladung}>
              <Share2 className="h-4 w-4" />
              {copied ? "Kopiert" : `Einladung ${trip.inviteCode}`}
            </Button>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-base text-muted-foreground">
              <span>
                <strong className="text-foreground">{tripOpenStats.total}</strong>{" "}
                Items
              </span>
              {tripOpenStats.openTotal > 0 ? (
                <span className="flex flex-wrap items-center gap-2">
                  {tripOpenStats.buckets.map((b) => (
                    <span
                      key={b.key}
                      className="glass glass-thin inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm"
                      title={`${b.label}: ${b.open} offen`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: b.color }}
                      />
                      <span>
                        {b.label}{" "}
                        <strong className="text-foreground">{b.open}</strong>
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="font-semibold text-primary">Alles erledigt</span>
              )}
            </div>
            {aiMessage && (
              <p className="glass tint-teal rounded-[var(--r-md)] px-3.5 py-2.5 text-base text-foreground">
                {aiMessage}
              </p>
            )}
          </div>
        )}

        {!headerDetails && aiMessage && (
          <p className="glass tint-teal rounded-[var(--r-md)] px-3.5 py-2.5 text-base text-foreground">
            {aiMessage}
          </p>
        )}
      </header>

      {activeTab === "pack" && (
        <section className="space-y-4">
          <div className="hero-panel px-5 py-5">
            <ChecklistMotif className="absolute -right-1 bottom-0 h-24 w-36 opacity-35" />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-eyebrow text-[rgba(209,250,229,0.82)]">
                  Packliste
                </p>
                <h2 className="mt-1 font-display text-section-title">
                  {tripOpenStats.openTotal === 0
                    ? "Alles gepackt"
                    : `Noch ${tripOpenStats.openTotal} offen`}
                </h2>
                <p className="mt-1 max-w-[22rem] text-sm text-[rgba(236,253,245,0.86)]">
                  Persönliches pro Person, gemeinsam nur was wirklich geteilt
                  wird.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="border-none bg-[rgba(255,255,255,0.18)] text-[#effefb] shadow-[inset_0_1px_0_rgba(255,255,255,0.30),inset_0_0_0_1px_rgba(255,255,255,0.20)]"
                  onClick={() => setAgentOpen(true)}
                >
                  <Bot className="h-4 w-4" />
                  Agent fragen
                </Button>
              </div>
            </div>
          </div>

          <PackProgressCard trip={trip} />

          {(!isOnline || pendingSync > 0) && (
            <div
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm",
                !isOnline
                  ? "glass tint-amber text-foreground"
                  : "glass tint-teal text-foreground"
              )}
              role="status"
            >
              {!isOnline
                ? "Offline — Änderungen werden später synchronisiert"
                : pendingSync === 1
                  ? "1 Änderung wird synchronisiert…"
                  : `${pendingSync} Änderungen werden synchronisiert…`}
            </div>
          )}

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onItemPhotoSelected(e)}
          />

          {duplicatePreview.groupCount > 0 && (
            <Card className="relative overflow-hidden">
              <ChecklistMotif className="pointer-events-none absolute -right-1 bottom-0 h-20 w-28 opacity-25" />
              <CardContent className="relative flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Doppelte Positionen
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {duplicatePreview.removedCount} ähnliche Einträge in{" "}
                    {duplicatePreview.groupCount} Gruppe(n) — z.B. Pass und
                    Reisepass. Mengen und Priorität werden zusammengeführt.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={cleanupBusy}
                  onClick={() => void cleanupDuplicates()}
                >
                  <Layers2 className="h-4 w-4" />
                  {cleanupBusy ? "…" : "Aufräumen"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* One glass toolbar instead of three stacked filter rows. */}
          <div className="glass sticky top-2 z-20 space-y-2.5 rounded-[var(--r-lg)] p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented label="Packliste filtern" className="min-w-0 flex-1 sm:flex-none">
                {(
                  [
                    ["open", "Offen", tripOpenStats.openTotal],
                    ["all", "Alle", null],
                    ["packed", "Gepackt", null],
                    ["shared", "Gemeinsam", null],
                  ] as const
                ).map(([id, label, count]) => (
                  <Segment
                    key={id}
                    active={filter === id}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                    {count != null && count > 0 && (
                      <Badge variant="warning" className="px-1.5 py-0">
                        {count}
                      </Badge>
                    )}
                  </Segment>
                ))}
              </Segmented>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAgentOpen(true)}
                >
                  <Bot className="h-4 w-4" />
                  Agent
                </Button>
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
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ParticipantFilter
                options={participantOptions}
                selected={participantFilter}
                onChange={setParticipantFilter}
              />
              {trip.suitcases.length > 0 && (
                <select
                  aria-label="Koffer filtern"
                  className={cn(selectClass, "h-9 py-0 text-sm")}
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
              )}
            </div>
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
                      ownerUserId: item.ownerUserId ?? null,
                      owner: (item.owner as PackItem["owner"]) ?? null,
                      notes: item.notes,
                      priority:
                        (item.priority as PackItem["priority"]) || "NORMAL",
                      source: item.source || "manual",
                      packedAt: item.packedAt ?? null,
                      packedByUserId: null,
                      packedBy: null,
                      suitcaseId: item.suitcaseId ?? null,
                      suitcase: (item.suitcase as PackItem["suitcase"]) ?? null,
                      photoUrl:
                        (item as { photoUrl?: string | null }).photoUrl ?? null,
                    },
                  ],
                };
              });
            }}
          />

          <div
            className={cn(
              "space-y-6",
              !viewingOnePerson &&
                "lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
            )}
          >
            {viewingOnePerson ? (
              ownerGroups.map(renderOwnerGroup)
            ) : (
              <>
                <div className="space-y-6">
                  {selfGroup && renderOwnerGroup(selfGroup)}
                </div>
                <div className="space-y-6">
                  {otherGroups.map(renderOwnerGroup)}
                </div>
                <div className="space-y-6 lg:col-span-2">
                  {sharedGroups.map(renderOwnerGroup)}
                </div>
              </>
            )}
            {ownerGroups.length === 0 && (
              <Card className="p-6 text-center lg:col-span-2">
                <ChecklistMotif className="mx-auto h-24 w-36 opacity-80" />
                <p className="mt-3 text-base text-muted-foreground">
                  Noch keine Positionen — mit «Position hinzufügen» starten oder
                  KI nutzen.
                </p>
              </Card>
            )}
          </div>
        </section>
      )}

      {activeTab === "legs" && (
        <section className="space-y-4">
          <div className="hero-panel px-5 py-6" style={{ background: "linear-gradient(150deg, rgba(180,83,9,0.90), rgba(217,119,6,0.74) 52%, rgba(15,118,110,0.62))" }}>
            <TravelMotif className="absolute -right-2 bottom-0 h-28 w-44 opacity-45" />
            <p className="text-eyebrow text-[rgba(254,243,199,0.85)]">Route</p>
            <h2 className="mt-1 font-display text-section-title">Etappen der Reise</h2>
            <p className="mt-1 max-w-md text-base text-[rgba(255,251,235,0.90)]">
              Orte, Transport und Wetter — getrennt von der Packliste.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={weatherBusy}
              onClick={() => void loadWeather()}
            >
              <CloudSun className="h-3.5 w-3.5" />
              {weatherBusy ? "Wetter…" : "Wetter für alle Etappen"}
            </Button>
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-section-title text-foreground">Etappen</h3>
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
                    <li className="glass tint-teal list-none rounded-[var(--r-lg)] px-4 py-3.5">
                      <div className="text-sm font-semibold uppercase tracking-wide text-primary">
                        {TRANSPORT_LABELS[leg.transport] || leg.transport}
                      </div>
                      <h4 className="mt-0.5 text-card-title font-semibold text-foreground">
                        {leg.name}
                      </h4>
                      {leg.location && (
                        <p className="text-base text-muted-foreground">{leg.location}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(leg.startDate)} – {formatDate(leg.endDate)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Wäsche: {leg.laundryAvailable ? "Ja" : "Nein"}
                        {(leg.weatherTags || []).length > 0
                          ? ` · ${(leg.weatherTags || [])
                              .map(
                                (t) =>
                                  WEATHER_TAG_LABELS[t as WeatherTag] || t
                              )
                              .join(", ")}`
                          : ""}
                      </p>
                      {leg.weatherSummary?.label && (
                        <p className="mt-1 text-sm text-teal-900">
                          <CloudSun className="mr-1 inline h-3.5 w-3.5" />
                          {leg.weatherSummary.label}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => startEditLeg(leg)}
                        >
                          Datum & Destination ändern
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={weatherBusy || !leg.location}
                          onClick={() => void loadWeather(leg.id)}
                        >
                          <CloudSun className="h-3.5 w-3.5" />
                          Wetter
                        </Button>
                      </div>
                    </li>
                  </SwipeRow>
                );
              })}
            </ul>

            {editingLegId && (
              <div className="card-surface p-4">
                <h4 className="font-display text-section-title text-foreground">
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
                            "rounded-full border px-2.5 py-1 text-xs font-medium",
                            legDraft.location === preset
                              ? "glass tint-teal text-foreground shadow-[inset_0_0_0_1.5px_var(--primary)]"
                              : "border-[var(--edge)] bg-[var(--glass-thin)] text-muted-foreground"
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
                      className="glass glass-thin mt-1 h-11 w-full rounded-[var(--r-sm)] px-3 text-sm text-foreground"
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
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={legDraft.laundryAvailable}
                        onChange={(e) =>
                          setLegDraft((d) => ({
                            ...d,
                            laundryAvailable: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-[var(--edge-strong)]"
                      />
                      Wäsche verfügbar
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Wetter-Tags</Label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(
                        Object.keys(WEATHER_TAG_LABELS) as WeatherTag[]
                      ).map((tag) => {
                        const on = legDraft.weatherTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setLegDraft((d) => ({
                                ...d,
                                weatherTags: on
                                  ? d.weatherTags.filter((t) => t !== tag)
                                  : [...d.weatherTags, tag],
                              }))
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs font-medium",
                              on
                                ? "glass tint-teal text-foreground shadow-[inset_0_0_0_1.5px_var(--primary)]"
                                : "border-[var(--edge)] bg-[var(--glass-thin)] text-muted-foreground"
                            )}
                          >
                            {WEATHER_TAG_LABELS[tag]}
                          </button>
                        );
                      })}
                    </div>
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
                <p className="mt-2 text-sm text-muted-foreground">
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
          <div className="hero-panel px-5 py-6">
            <SuitcaseCardArt className="absolute -right-2 -top-1 h-24 w-36 opacity-50" />
            <p className="text-eyebrow text-[rgba(209,250,229,0.82)]">Übersicht</p>
            <h2 className="mt-1 font-display text-section-title">Was liegt wo?</h2>
            <p className="mt-1 max-w-md text-base text-[rgba(236,253,245,0.86)]">
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
              <p className="text-eyebrow text-primary">Neuer Koffer</p>
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
                    className={fieldClass}
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
                    className={fieldClass}
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
                      <div className="font-display text-lg text-foreground">
                        {s.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
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
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--edge-strong)]">
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
                      <ChevronDown className="h-4 w-4 text-subtle" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-subtle" />
                    )}
                  </button>
                  {expanded && (
                    <div className="space-y-3 border-t border-[var(--edge)] px-3 pb-3 pt-3">
                      {editingThis ? (
                        <form
                          className="glass tint-teal space-y-3 rounded-[var(--r-md)] p-3"
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
                          <p className="text-eyebrow text-primary">
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
                                className={fieldClass}
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
                                className={fieldClass}
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
                          <p className="mt-1 text-sm text-muted-foreground">
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
                                      ? "bg-[var(--glass-thin)] text-muted-foreground line-through"
                                      : "bg-[var(--glass-thin)] text-foreground"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                                      item.packedAt
                                        ? "border-teal-700 bg-teal-700 text-white"
                                        : "text-transparent shadow-[inset_0_0_0_1.5px_var(--edge-strong)]"
                                    )}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-[var(--edge)] bg-[var(--glass-thin)]">
                                    <ItemIllustration
                                      name={item.name}
                                      category={item.category}
                                      photoUrl={item.photoUrl}
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    {item.quantity}× {item.name}
                                    {open > 0 && !item.packedAt ? (
                                      <span className="ml-1 text-[10px] font-semibold uppercase text-[var(--amber-700)] dark:text-[#fbbf24]">
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
                        <p className="text-xs text-subtle">
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
          <div className="hero-panel px-5 py-6" style={{ background: "linear-gradient(150deg, rgba(11,61,57,0.92), rgba(15,118,110,0.76) 52%, rgba(180,83,9,0.62))" }}>
            <TipsMotif className="absolute -right-1 bottom-0 h-28 w-40 opacity-50" />
            <p className="text-eyebrow text-[rgba(209,250,229,0.82)]">KI & Ratgeber</p>
            <h2 className="mt-1 font-display text-section-title">Tipps zur Reise</h2>
            <p className="mt-1 max-w-md text-base text-[rgba(236,253,245,0.86)]">
              Packliste verfeinern, Guides und Do&apos;s/Don&apos;ts — gespeichert
              auf dieser Reise.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setAgentOpen(true)}>
              <Bot className="h-4 w-4" />
              Pack-Agent
            </Button>
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
          <p className="text-sm text-muted-foreground">
            «Neu berechnen» ergänzt fehlende Positionen, weist Koffer nach Kapazität
            zu und aktualisiert die Reisetipps — z.B. nach geänderten Etappen.
          </p>

          {!hasInsights ? (
            <div className="card-surface p-6 text-center">
              <TipsMotif className="mx-auto mb-3 h-28 w-auto max-w-[240px] opacity-90" />
              <p className="font-medium text-foreground">
                Noch keine AI-Infos gespeichert
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Verfeinere die Packliste oder generiere Reisetipps — sie bleiben
                auf dieser Reise gespeichert.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {insights.tips.length > 0 && (
                <div className="card-surface relative overflow-hidden p-4">
                  <TipsMotif className="pointer-events-none absolute -right-2 -top-1 h-20 w-28 opacity-25" />
                  <h3 className="relative font-display text-lg text-foreground">
                    Tipps
                  </h3>
                  <ul className="relative mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                    {insights.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
              {insights.guides.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-display text-lg text-foreground">Guides</h3>
                  {insights.guides.map((guide) => (
                    <article
                      key={`${guide.title}-${guide.body.slice(0, 24)}`}
                      className="card-surface px-4 py-3"
                    >
                      <h4 className="font-semibold text-foreground">
                        {guide.title}
                      </h4>
                      {guide.body.split(/\n+/).map((para, idx) => (
                        <p
                          key={idx}
                          className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                        >
                          {para}
                        </p>
                      ))}
                    </article>
                  ))}
                </div>
              )}
              {insights.updatedAt && (
                <p className="text-xs text-subtle">
                  Aktualisiert: {formatDate(insights.updatedAt)}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "people" && (
        <TripTeamPanel
          trip={trip}
          userId={user.id}
          isTripOwner={isTripOwner}
          copied={copied}
          routeCopied={routeCopied}
          onCopyInvite={copyEinladung}
          onPatchInvite={patchInvite}
          onCopyRoute={copyRouteShare}
          onPatchRoute={patchRouteShare}
          onRemoveMember={removeMember}
          canRemoveMember={canRemoveMember}
          onLeaveOrDelete={() => void removeTripOrLeave()}
        />
      )}

      {agentOpen && (
        <PackAgentPanel
          tripId={trip.id}
          members={trip.members}
          onApplied={(data) => {
            applyTripPayload(data as Trip);
            setAiMessage("Pack-Agent hat bestätigte Positionen ergänzt.");
          }}
          onClose={() => setAgentOpen(false)}
        />
      )}

      <FloatingDock label="Reise-Bereiche">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <DockItem
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => setTab(tab.id)}
            >
              <Icon className="h-5 w-5" />
            </DockItem>
          );
        })}
      </FloatingDock>
    </div>
  );
}
