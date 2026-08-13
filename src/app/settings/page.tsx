"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = {
  configured: boolean;
  source: "env" | "settings" | "none";
  maskedKey: string | null;
  model: string;
  features: string[];
  note?: string;
};

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/ai/settings");
    const data = await res.json();
    setStatus(data);
    setModel(data.model || "gpt-4.1-mini");
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: apiKey || undefined,
          model,
        }),
      });
      const data = await res.json();
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              configured: data.configured,
              maskedKey: data.maskedKey,
              model: data.model,
              note: data.note,
              source: data.configured
                ? prev.source === "env"
                  ? "env"
                  : "settings"
                : "none",
            }
          : data
      );
      setApiKey("");
      setMessage("Gespeichert.");
      await load();
    } catch {
      setMessage("Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const clearKey = async () => {
    setBusy(true);
    try {
      await fetch("/api/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiApiKey: "" }),
      });
      setMessage("Schlüssel aus den Einstellungen entfernt.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-8">
      <Link href="/" className="text-sm font-semibold text-teal-800">
        ← FlexiPack
      </Link>
      <h1 className="mt-4 font-display text-3xl text-stone-950">
        KI-Einstellungen
      </h1>
      <p className="mt-2 text-stone-600">
        OpenAI steuert Freitext-Erkennung, Packlisten-Verfeinerung und Tipps.
        Ohne Schlüssel fällt FlexiPack auf den Regelparser zurück.
      </p>

      <div className="mt-8 space-y-6 rounded-2xl border border-stone-200 bg-white/80 p-5">
        <div className="flex items-start gap-3">
          {status?.configured ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-teal-700" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
          )}
          <div>
            <div className="font-semibold text-stone-900">
              {status?.configured ? "KI aktiv" : "KI nicht konfiguriert"}
            </div>
            <p className="text-sm text-stone-600">
              Quelle:{" "}
              {status?.source === "env"
                ? "Umgebung"
                : status?.source === "settings"
                  ? "Einstellungen"
                  : "keine"}
              {status?.maskedKey ? ` · Schlüssel ${status.maskedKey}` : ""}
              {" · "}Modell {status?.model || model}
            </p>
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1">
            <KeyRound className="h-3 w-3" /> OpenAI-API-Schlüssel
          </Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-stone-500">
            Wird unter <code>data/ai-settings.json</code> gespeichert
            (Docker-Volume). Alternativ: Umgebungsvariable{" "}
            <code>OPENAI_API_KEY</code> (hat Vorrang).
          </p>
        </div>

        <div>
          <Label>Modell</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4.1-mini"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy}>
            Speichern
          </Button>
          <Button variant="outline" onClick={clearKey} disabled={busy}>
            Schlüssel löschen
          </Button>
        </div>
        {message && <p className="text-sm text-teal-800">{message}</p>}
        {status?.note && <p className="text-sm text-amber-800">{status.note}</p>}
      </div>

      <div className="mt-8 rounded-2xl border border-teal-100 bg-teal-50/70 p-5">
        <div className="mb-2 flex items-center gap-2 font-semibold text-teal-950">
          <Sparkles className="h-4 w-4" /> Wo die KI hilft
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-teal-950/80">
          {(status?.features || []).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
