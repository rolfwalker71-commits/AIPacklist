"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";

type Preview = {
  code: string;
  title: string;
  ownerName: string;
  summary: string;
  startDate: string;
  endDate: string;
  legs: {
    name: string;
    location: string | null;
    startDate: string;
    endDate: string;
    transport: string;
  }[];
};

/**
 * Redeem a route-share code into a brand-new independent trip.
 */
export function StartFromRouteForm({
  initialCode = "",
}: {
  initialCode?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch(
        `/api/route-share?code=${encodeURIComponent(code.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Code ungültig");
      setPreview(data);
      if (!title.trim()) setTitle(`Route: ${data.title}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!preview) {
      await loadPreview();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/route-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: preview.code,
          title: title.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Anlegen fehlgeschlagen");
      router.push(`/trip/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={create} className="card-surface space-y-4 p-5">
      <div className="flex items-start gap-3">
        <MapPinned className="mt-0.5 h-6 w-6 shrink-0 text-teal-800" />
        <div>
          <h2 className="font-display text-section-title text-stone-900">
            Aus Route starten
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Nur Etappen werden übernommen — Packliste und Koffer bleiben leer.
            Danach eigene Gruppe und eigenen Einladungscode.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="route-code">Route-Code</Label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Input
            id="route-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setPreview(null);
            }}
            placeholder="z.B. AB12CD"
            className="min-w-0 flex-1"
            required
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !code.trim()}
            onClick={() => void loadPreview()}
          >
            Prüfen
          </Button>
        </div>
      </div>

      {preview && (
        <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-3 text-sm text-stone-700">
          <p className="font-semibold text-stone-900">{preview.title}</p>
          <p className="mt-0.5 text-stone-600">
            von {preview.ownerName} · {preview.summary}
          </p>
          <ul className="mt-2 space-y-1">
            {preview.legs.map((leg, i) => (
              <li key={`${leg.name}-${i}`}>
                <strong>{leg.name}</strong>
                {leg.location ? ` · ${leg.location}` : ""} ·{" "}
                {formatDate(leg.startDate)} – {formatDate(leg.endDate)}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Label htmlFor="route-title">Titel deiner neuen Reise</Label>
            <Input
              id="route-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
      )}

      {error && <p className="text-base text-rose-700">{error}</p>}

      <Button type="submit" disabled={busy || !code.trim()}>
        {busy
          ? "…"
          : preview
            ? "Eigene Reise mit dieser Route anlegen"
            : "Code prüfen"}
      </Button>
    </form>
  );
}
