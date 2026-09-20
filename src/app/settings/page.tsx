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
    <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-8 lg:px-8 lg:pt-10">
      <Link href="/profil" className="text-base font-semibold text-primary">
        ← Profil
      </Link>
      <div className="mt-4 flex items-start gap-3">
        <Sparkles className="mt-1 h-8 w-8 shrink-0 text-primary" />
        <div>
          <h1 className="font-display text-page-title text-foreground">
            KI-Einstellungen
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            OpenAI steuert Freitext-Erkennung, Packlisten-Verfeinerung und Tipps.
            Ohne Schlüssel fällt FlexiPack auf den Regelparser zurück.
          </p>
        </div>
      </div>

      <div className="glass rounded-[var(--r-lg)] mt-8 space-y-6 p-5">
        <div className="flex items-start gap-3">
          {status?.configured ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--amber-700)] dark:text-[#fbbf24]" />
          )}
          <div>
            <div className="font-semibold text-foreground">
              {status?.configured ? "KI aktiv" : "KI nicht konfiguriert"}
            </div>
            <p className="text-sm text-muted-foreground">
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
          <p className="mt-1 text-xs text-muted-foreground">
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
        {message && <p className="text-sm text-primary">{message}</p>}
        {status?.note && <p className="text-sm text-[var(--amber-700)] dark:text-[#fbbf24]">{status.note}</p>}
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--edge)] bg-[var(--secondary)] p-5">
        <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
          <Sparkles className="h-4 w-4" /> Wo die KI hilft
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
          {(status?.features || []).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
