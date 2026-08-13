"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Check,
  Link2,
  Users,
  Luggage,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenderPicker } from "@/components/ui/gender-picker";
import { cn, formatDate } from "@/lib/utils";
import { ensureLocalUser, setLocalUser, type LocalUser } from "@/lib/local-user";
import type { PackGender } from "@/lib/types";
import { SUITCASE_SIZES } from "@/lib/suitcases";

type PackItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  isShared: boolean;
  notes: string | null;
  packedAt: string | null;
  packedByUserId: string | null;
  suitcaseId: string | null;
  packedBy?: { id: string; name: string; color: string } | null;
  suitcase?: { id: string; name: string } | null;
};

type Trip = {
  id: string;
  title: string;
  inviteCode: string;
  startDate: string;
  endDate: string;
  legs: {
    id: string;
    name: string;
    transport: string;
    laundryAvailable: boolean;
    weatherTags: string[];
    dressCodes: string[];
    startDate: string;
    endDate: string;
  }[];
  items: PackItem[];
  suitcases: {
    id: string;
    name: string;
    size: string;
    isShared: boolean;
    ownerUserId: string | null;
    owner?: { name: string } | null;
  }[];
  members: {
    role: string;
    user: { id: string; name: string; color: string; gender?: string };
  }[];
};

export function TripWorkspace({ initialTrip }: { initialTrip: Trip }) {
  const [trip, setTrip] = useState(initialTrip);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "packed" | "shared">(
    "all"
  );
  const [suitcaseFilter, setSuitcaseFilter] = useState<string>("all");
  const [nameDraft, setNameDraft] = useState("");
  const [genderDraft, setGenderDraft] = useState<PackGender>("UNSPECIFIED");
  const [copied, setCopied] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  useEffect(() => {
    const u = ensureLocalUser();
    setUser(u);
    setNameDraft(u.name);
    setGenderDraft(u.gender || "UNSPECIFIED");
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/trips/${trip.id}/events`);
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        if (event.type === "item_updated" && event.payload) {
          setTrip((prev) => {
            const exists = prev.items.some((i) => i.id === event.itemId);
            const items = exists
              ? prev.items.map((i) =>
                  i.id === event.itemId ? { ...i, ...event.payload } : i
                )
              : event.payload.created
                ? [...prev.items, event.payload]
                : prev.items;
            return { ...prev, items };
          });
        }
        if (event.type === "member_joined" || event.type === "trip_updated") {
          fetch(`/api/trips/${trip.id}`)
            .then((r) => r.json())
            .then(setTrip)
            .catch(() => undefined);
        }
      } catch {
        // ignore
      }
    };
    return () => es.close();
  }, [trip.id]);

  const saveName = () => {
    if (!user || !nameDraft.trim()) return;
    const next = { ...user, name: nameDraft.trim(), gender: genderDraft };
    setLocalUser(next);
    setUser(next);
    fetch(`/api/trips/${trip.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: next, inviteCode: trip.inviteCode }),
    }).catch(() => undefined);
  };

  const togglePacked = useCallback(
    async (item: PackItem) => {
      if (!user) return;
      const packed = !item.packedAt;
      // optimistic
      setTrip((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                packedAt: packed ? new Date().toISOString() : null,
                packedByUserId: packed ? user.id : null,
                packedBy: packed
                  ? { id: user.id, name: user.name, color: user.color }
                  : null,
              }
            : i
        ),
      }));

      await fetch(`/api/trips/${trip.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          packed,
          userId: user.id,
          userName: user.name,
          userColor: user.color,
        }),
      });
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

  const updateSuitcaseSize = async (suitcaseId: string, size: string) => {
    setTrip((prev) => ({
      ...prev,
      suitcases: prev.suitcases.map((s) =>
        s.id === suitcaseId ? { ...s, size } : s
      ),
    }));
    const res = await fetch(`/api/trips/${trip.id}/suitcases`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suitcaseId, size }),
    });
    if (res.ok) setTrip(await res.json());
  };

  const addSuitcase = async () => {
    const res = await fetch(`/api/trips/${trip.id}/suitcases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Koffer ${trip.suitcases.length + 1}`,
        size: "MEDIUM",
        ownerUserId: user?.id,
      }),
    });
    if (res.ok) setTrip(await res.json());
  };

  const removeSuitcase = async (suitcaseId: string) => {
    const res = await fetch(
      `/api/trips/${trip.id}/suitcases?suitcaseId=${suitcaseId}`,
      { method: "DELETE" }
    );
    if (res.ok) setTrip(await res.json());
  };

  const enrichWithAi = async () => {
    setAiBusy(true);
    setAiMessage(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/ai-enrich`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setAiMessage(data.error || "KI fehlgeschlagen");
        return;
      }
      const { tips, added, ...tripData } = data;
      setTrip(tripData);
      setAiTips(tips || []);
      setAiMessage(
        added
          ? `${added} KI-Einträge ergänzt`
          : "Keine neuen KI-Einträge — Liste wirkt schon vollständig"
      );
    } catch {
      setAiMessage("KI fehlgeschlagen");
    } finally {
      setAiBusy(false);
    }
  };

  const filtered = useMemo(() => {
    return trip.items.filter((item) => {
      if (filter === "open" && item.packedAt) return false;
      if (filter === "packed" && !item.packedAt) return false;
      if (filter === "shared" && !item.isShared) return false;
      if (suitcaseFilter !== "all" && item.suitcaseId !== suitcaseFilter)
        return false;
      return true;
    });
  }, [trip.items, filter, suitcaseFilter]);

  const byCategory = useMemo(() => {
    const map = new Map<string, PackItem[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return [...map.entries()];
  }, [filtered]);

  const progress = useMemo(() => {
    const total = trip.items.length || 1;
    const packed = trip.items.filter((i) => i.packedAt).length;
    return Math.round((packed / total) * 100);
  }, [trip.items]);

  const copyEinladung = async () => {
    const url = `${window.location.origin}/join?code=${trip.inviteCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
              FlexiPack-Reise
            </p>
            <h1 className="font-display text-3xl text-stone-950 md:text-4xl">
              {trip.title}
            </h1>
            <p className="mt-1 text-stone-600">
              {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{" "}
              {trip.legs.length} Etappen
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={enrichWithAi} disabled={aiBusy}>
              <Sparkles className="h-4 w-4" />
              {aiBusy ? "KI denkt…" : "Liste mit KI verfeinern"}
            </Button>
            <Button variant="outline" onClick={copyEinladung}>
              <Share2 className="h-4 w-4" />
              {copied ? "Kopiert" : `Einladung ${trip.inviteCode}`}
            </Button>
          </div>
        </div>
        {(aiMessage || aiTips.length > 0) && (
          <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-950">
            {aiMessage && <p className="font-medium">{aiMessage}</p>}
            {aiTips.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-teal-900/80">
                {aiTips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full rounded-full bg-teal-700 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-stone-600">{progress}% gepackt</p>

        <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white/70 p-4 md:grid-cols-3">
          <div className="space-y-3">
            <div>
              <Label>Dein Name</Label>
              <div className="flex gap-2">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                />
                <Button variant="secondary" onClick={saveName}>
                  Speichern
                </Button>
              </div>
            </div>
            <GenderPicker value={genderDraft} onChange={setGenderDraft} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Users className="h-3 w-3" /> Mitreisende
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {trip.members.map((m) => (
                <span
                  key={m.user.id}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: m.user.color }}
                  />
                  {m.user.name}
                  <span className="text-stone-400">
                    {m.role === "OWNER"
                      ? "Besitzer:in"
                      : m.role === "PARTNER"
                        ? "Mitreisende:r"
                        : m.role}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Link2 className="h-3 w-3" /> Einladung
            </Label>
            <p className="mt-2 text-sm text-stone-600">
              Mitreisende:r mit Code <strong>{trip.inviteCode}</strong> beitreten.
              Gemeinsame Einträge erscheinen live als „Gepackt von …“.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {trip.legs.map((leg) => (
          <div
            key={leg.id}
            className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              {({
                SHIP: "Schiff",
                FLIGHT: "Flug",
                CAR: "Auto",
                TRAIN: "Zug",
                OTHER: "Sonstiges",
              } as Record<string, string>)[leg.transport] || leg.transport}
            </div>
            <h3 className="mt-1 font-semibold text-stone-900">{leg.name}</h3>
            <p className="mt-1 text-xs text-stone-500">
              {formatDate(leg.startDate)} – {formatDate(leg.endDate)}
            </p>
            <p className="mt-2 text-xs text-stone-600">
              Wäsche: {leg.laundryAvailable ? "Ja" : "Nein"} ·{" "}
              {(leg.weatherTags || []).join(", ")}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
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
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                filter === id
                  ? "border-teal-800 bg-teal-800 text-white"
                  : "border-stone-200 bg-white text-stone-600"
              )}
            >
              {label}
            </button>
          ))}
          <select
            className="ml-auto rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
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
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-stone-900">Koffer</h3>
            <Button type="button" variant="secondary" size="sm" onClick={addSuitcase}>
              Koffer hinzufügen
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {trip.suitcases.map((s) => {
              const count = trip.items.filter((i) => i.suitcaseId === s.id).length;
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
                        className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs"
                        value={s.size}
                        onChange={(e) =>
                          updateSuitcaseSize(s.id, e.target.value)
                        }
                      >
                        {SUITCASE_SIZES.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label} — {opt.hint}
                          </option>
                        ))}
                      </select>
                    </div>
                    {trip.suitcases.length > 1 && (
                      <button
                        type="button"
                        className="text-xs text-rose-600"
                        onClick={() => removeSuitcase(s.id)}
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

        <div className="space-y-6">
          {byCategory.map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-2 flex items-center gap-2 font-display text-lg text-stone-900">
                <Briefcase className="h-4 w-4 text-teal-800" />
                {category}
              </h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border px-3 py-3 transition sm:flex-row sm:items-center",
                      item.packedAt
                        ? "border-teal-200 bg-teal-50/60"
                        : "border-stone-200 bg-white/80"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => togglePacked(item)}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        item.packedAt
                          ? "border-teal-700 bg-teal-700 text-white"
                          : "border-stone-300 bg-white text-transparent"
                      )}
                      aria-label="Als gepackt markieren"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-900">
                        {item.quantity}× {item.name}
                        {item.isShared && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                            Gemeinsam
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500">
                        {item.notes}
                        {item.packedAt && item.packedBy && (
                          <span className="ml-1 font-medium text-teal-800">
                            · Gepackt von {item.packedBy.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <select
                      className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs"
                      value={item.suitcaseId || ""}
                      onChange={(e) => moveSuitcase(item.id, e.target.value)}
                    >
                      {trip.suitcases.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({SUITCASE_SIZES.find((x) => x.id === s.size)?.label || s.size})
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
