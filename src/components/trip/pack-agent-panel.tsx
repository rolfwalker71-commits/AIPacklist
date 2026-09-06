"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemIllustration } from "@/components/trip/item-illustration";
import { cn } from "@/lib/utils";
import type { AgentProposal, AgentScope } from "@/lib/pack-agent";

type Member = {
  user: { id: string; name: string };
};

type ChatLine = {
  role: "user" | "assistant";
  text: string;
};

type Draft = AgentProposal & { scope: AgentScope; ownerUserId: string | null };

export function PackAgentPanel({
  tripId,
  members,
  onApplied,
  onClose,
}: {
  tripId: string;
  members: Member[];
  onApplied: (trip: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines, drafts, busy]);

  const runReview = async (message?: string, historyLines?: ChatLine[]) => {
    setBusy(true);
    setError(null);
    try {
      const history = (historyLines || lines).map((l) => ({
        role: l.role,
        text: l.text,
      }));
      const res = await fetch(`/api/trips/${tripId}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          message,
          history,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Agent fehlgeschlagen"
        );
      }
      const reply = String(data.reply || "").trim();
      const proposals = Array.isArray(data.proposals)
        ? (data.proposals as AgentProposal[])
        : [];
      setLines((prev) =>
        reply ? [...prev, { role: "assistant", text: reply }] : prev
      );
      setDrafts(
        proposals.map((p) => ({
          ...p,
          scope: p.suggestedScope,
          ownerUserId:
            p.suggestedScope === "person"
              ? p.suggestedUserId || members[0]?.user.id || null
              : null,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runReview();
    // initial review only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ask = async () => {
    const text = input.trim();
    if (!text || busy || applying) return;
    setInput("");
    const next = [...lines, { role: "user" as const, text }];
    setLines(next);
    await runReview(text, next);
  };

  const applyDrafts = async (chosen: Draft[]) => {
    if (!chosen.length || applying) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          proposals: chosen.map((d) => ({
            name: d.name,
            category: d.category,
            quantity: d.quantity,
            priority: d.priority,
            notes: d.reason,
            scope: d.scope,
            ownerUserId: d.ownerUserId,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Speichern fehlgeschlagen"
        );
      }
      const ids = new Set(chosen.map((c) => c.id));
      setDrafts((prev) => prev.filter((d) => !ids.has(d.id)));
      if (data.reply) {
        setLines((prev) => [...prev, { role: "assistant", text: data.reply }]);
      }
      onApplied(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setApplying(false);
    }
  };

  const setDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pack-agent-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(36rem,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-[#FBF7F0]"
        style={{
          paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))",
        }}
      >
        <header className="flex items-center gap-2 border-b border-stone-200 px-3.5 py-3">
          <Bot className="h-5 w-5 shrink-0 text-teal-800" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2
              id="pack-agent-title"
              className="text-base font-semibold text-stone-900"
            >
              Pack-Agent
            </h2>
            <p className="text-sm text-stone-500">
              Prüft die Liste und schreibt erst nach Bestätigung.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Schliessen"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
          {lines.map((line, idx) => (
            <p
              key={`${line.role}-${idx}`}
              className={cn(
                "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-base leading-snug",
                line.role === "user"
                  ? "ml-auto bg-teal-800 text-teal-50"
                  : "bg-white text-stone-800 ring-1 ring-stone-200"
              )}
            >
              {line.text}
            </p>
          ))}

          {busy && (
            <p className="text-sm text-stone-500" role="status">
              Prüfe die Packliste…
            </p>
          )}

          {drafts.length > 0 && (
            <ul className="space-y-2">
              {drafts.map((draft) => (
                <li
                  key={draft.id}
                  className="rounded-2xl border border-stone-200 bg-white p-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                      <ItemIllustration
                        name={draft.name}
                        category={draft.category}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-stone-900">
                        {draft.quantity}× {draft.name}
                      </p>
                      <p className="text-sm text-stone-500">{draft.reason}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <button
                        key={m.user.id}
                        type="button"
                        className={cn(
                          "min-h-10 rounded-full px-3 text-sm font-semibold",
                          draft.scope === "person" &&
                            draft.ownerUserId === m.user.id
                            ? "bg-muted text-teal-900"
                            : "bg-stone-100 text-stone-600"
                        )}
                        onClick={() =>
                          setDraft(draft.id, {
                            scope: "person",
                            ownerUserId: m.user.id,
                          })
                        }
                      >
                        {m.user.name}
                      </button>
                    ))}
                    {members.length > 1 && (
                      <button
                        type="button"
                        className={cn(
                          "min-h-10 rounded-full px-3 text-sm font-semibold",
                          draft.scope === "both"
                            ? "bg-muted text-teal-900"
                            : "bg-stone-100 text-stone-600"
                        )}
                        onClick={() =>
                          setDraft(draft.id, {
                            scope: "both",
                            ownerUserId: null,
                          })
                        }
                      >
                        Beide
                      </button>
                    )}
                    <button
                      type="button"
                      className={cn(
                        "min-h-10 rounded-full px-3 text-sm font-semibold",
                        draft.scope === "shared"
                          ? "bg-muted text-teal-900"
                          : "bg-stone-100 text-stone-600"
                      )}
                      onClick={() =>
                        setDraft(draft.id, {
                          scope: "shared",
                          ownerUserId: null,
                        })
                      }
                    >
                      Gemeinsam
                    </button>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={applying}
                      onClick={() => void applyDrafts([draft])}
                    >
                      Übernehmen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={applying}
                      onClick={() =>
                        setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
                      }
                    >
                      Weglassen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="space-y-2 border-t border-stone-200 px-3.5 py-3">
          {drafts.length > 1 && (
            <Button
              type="button"
              className="w-full"
              disabled={applying || busy}
              onClick={() => void applyDrafts(drafts)}
            >
              {applying ? "Schreibe…" : `Alle ${drafts.length} übernehmen`}
            </Button>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nachfragen oder etwas ergänzen…"
              disabled={busy || applying}
              aria-label="Nachricht an den Pack-Agenten"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || applying || !input.trim()}
              aria-label="Senden"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </footer>
      </div>
    </div>
  );
}
