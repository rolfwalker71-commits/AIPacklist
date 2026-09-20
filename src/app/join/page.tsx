"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TravelMotif } from "@/components/app/travel-motif";

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
    <div className="glass rounded-[var(--r-lg)] mx-auto max-w-md space-y-4 p-6">
      <div>
        <Label>Einladungscode</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Du trittst mit deinem angemeldeten Konto bei. Partner:innen brauchen
        ebenfalls ein vom Admin angelegtes Benutzerkonto.
      </p>
      {error && <p className="text-base text-destructive">{error}</p>}
      <Button className="w-full" disabled={busy || !code} onClick={join}>
        Beitreten
      </Button>
    </div>
  );
}

export default function JoinPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-8 pt-8 md:max-w-2xl lg:px-8 lg:pt-10">
      <Link href="/" className="text-base font-semibold text-primary">
        ← Reisen
      </Link>
      <h1 className="mt-4 font-display text-page-title text-foreground">
        Reise beitreten
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        Pack-Einladung von der Trip-Besitzer:in — gemeinsame Packliste. Danach
        unter «Reisen».
      </p>
      <TravelMotif className="mt-4 h-28 w-full max-w-xs opacity-80" />
      <div className="mt-4">
        <Suspense fallback={<p className="text-base text-muted-foreground">Laden…</p>}>
          <JoinForm />
        </Suspense>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Nur die Route (Etappen) übernehmen und selbst packen?{" "}
        <Link href="/create" className="font-semibold text-primary">
          Aus Route starten
        </Link>
      </p>
    </main>
  );
}
