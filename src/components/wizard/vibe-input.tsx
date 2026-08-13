"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { TripDraft } from "@/lib/types";

interface Props {
  onParsed: (draft: TripDraft) => void;
}

export function VibeInput({ onParsed }: Props) {
  const [prompt, setPrompt] = useState(
    "13 Tage Transatlantik im Oktober ohne Wäsche, danach 5 Tage Florida"
  );
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const parse = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, startDate: startDate || undefined }),
      });
      if (!res.ok) throw new Error("Parse failed");
      const data = await res.json();
      setSummary(
        `${data.draft.legs.length} Etappen · ${data.summary.daysWithoutLaundry} Tage ohne Wäsche · ${data.preview.length} Items`
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
        <h3 className="font-display text-xl">Vibe Input</h3>
      </div>
      <p className="text-sm text-stone-600">
        Beschreibe deine Reise in natürlicher Sprache — FlexiPack zerlegt sie in
        Etappen mit Wetter-, Wäsche- und Dresscode-Logik.
      </p>
      <div>
        <Label>Optionaler Starttermin</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
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
        {busy ? "Parse…" : "In Etappen umwandeln"}
      </Button>
    </div>
  );
}
