"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [name, setName] = useState("Admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => setNeedsSetup(Boolean(d.needsSetup)))
      .catch(() => setNeedsSetup(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = needsSetup ? "/api/auth/setup" : "/api/auth/login";
      const body = needsSetup
        ? { name, username, password }
        : { username, password };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      setBusy(false);
    }
  };

  if (needsSetup === null) {
    return <p className="text-sm text-stone-500">Laden…</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-stone-950">
          {needsSetup ? "Admin einrichten" : "Anmelden"}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          {needsSetup
            ? "Erstelle den ersten Admin-Account. Weitere Benutzer legst du danach unter Benutzerverwaltung an — ohne offene Registrierung."
            : "Nur angelegte Benutzerkonten haben Zugang."}
        </p>
      </div>

      {needsSetup && (
        <div>
          <Label>Anzeigename</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
      )}

      <div>
        <Label>Benutzername</Label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          placeholder="z.B. rolf"
        />
      </div>
      <div>
        <Label>Passwort</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={needsSetup ? "new-password" : "current-password"}
          required
          minLength={8}
        />
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy
          ? "Bitte warten…"
          : needsSetup
            ? "Admin erstellen & starten"
            : "Anmelden"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
          FlexiPack
        </p>
        <Suspense fallback={<p className="text-sm text-stone-500">Laden…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
