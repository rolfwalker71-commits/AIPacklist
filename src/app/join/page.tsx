"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const find = await fetch(`/api/join?code=${encodeURIComponent(code)}`);
      if (!find.ok) throw new Error("Einladungscode ungültig");
      const trip = await find.json();

      const res = await fetch(`/api/trips/${trip.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Beitritt fehlgeschlagen");
      }
      router.push(`/trip/${trip.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-stone-200 bg-white/80 p-6">
      <div>
        <Label>Einladungscode</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
        />
      </div>
      <p className="text-xs text-stone-500">
        Du trittst mit deinem angemeldeten Konto bei. Partner:innen brauchen
        ebenfalls ein vom Admin angelegtes Benutzerkonto.
      </p>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <Button className="w-full" disabled={busy || !code} onClick={join}>
        Beitreten
      </Button>
    </div>
  );
}

export default function JoinPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <Link href="/" className="text-sm font-semibold text-teal-800">
        ← FlexiPack
      </Link>
      <h1 className="mt-4 font-display text-3xl text-stone-950">
        Reise beitreten
      </h1>
      <p className="mt-2 text-stone-600">
        Mit Einladungscode einer bestehenden Packliste beitreten.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-stone-500">Laden…</p>}>
          <JoinForm />
        </Suspense>
      </div>
    </main>
  );
}
