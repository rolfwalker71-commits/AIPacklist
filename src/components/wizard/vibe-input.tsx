"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import type { TravelerProfile, TripDraft } from "@/lib/types";
import Link from "next/link";

interface Props {
  onParsed: (draft: TripDraft) => void;
  travelers?: TravelerProfile[];
}

export function VibeInput({ onParsed, travelers }: Props) {
  const [prompt, setPrompt] = useState(
    "13 Tage Transatlantik im Oktober ohne Wäsche, danach 5 Tage Florida"
  );
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/ai/settings")
      .then((r) => r.json())
      .then((d) => setAiConfigured(Boolean(d.configured)))
      .catch(() => setAiConfigured(false));
  }, []);

  const parse = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          startDate: startDate || undefined,
          travelers,
        }),
      });
      if (!res.ok) throw new Error("Auswertung fehlgeschlagen");
      const data = await res.json();
      const engine =
        data.parseSource === "openai" ? "KI-Etappen" : "Regel-Etappen";
      const pack =
        data.packSource === "openai" ? "KI-Packliste" : "Regel-Packliste";
      setSummary(
        `${engine} · ${pack} · ${data.draft.legs.length} Etappen · ${data.summary.daysWithoutLaundry} Tage ohne Wäsche · ${data.preview.length} Einträge` +
          (data.tips?.length ? ` · ${data.tips.length} Tipps` : "")
      );
      onParsed(data.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-teal-900">
        <Sparkles className="h-5 w-5" />
        <h3 className="font-display text-xl">KI-Freitext</h3>
      </div>
      <p className="text-sm text-stone-600">
        Beschreibe deine Reise in natürlicher Sprache — mit API-Schlüssel zerlegt die KI die Etappen; ohne Schlüssel greift der Regelparser.
      </p>
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
        {aiConfigured === null
          ? "KI-Status wird geladen…"
          : aiConfigured
            ? "KI aktiv (OpenAI)"
            : (
              <>
                KI inaktiv — Schlüssel unter{" "}
                <Link href="/settings" className="font-semibold text-teal-800">
                  Einstellungen
                </Link>{" "}
                hinterlegen.
              </>
            )}
      </div>
      <div>
        <Label>Freiwilliger Starttermin</Label>
        <DatePicker
          value={startDate}
          onChange={setStartDate}
          allowEmpty
        />
      </div>
      <div>
        <Label>Freitext</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='z.B. "13 Tage Transatlantik im Oktober ohne Wäsche, danach 5 Tage Florida"'
        />
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {summary && <p className="text-sm text-teal-800">{summary}</p>}
      <Button onClick={parse} disabled={busy || !prompt.trim()}>
        {busy ? "KI wertet aus…" : "In Etappen umwandeln"}
      </Button>
    </div>
  );
}
