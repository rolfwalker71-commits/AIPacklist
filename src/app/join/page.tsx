"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenderPicker } from "@/components/ui/gender-picker";
import { ensureLocalUser, setLocalUser } from "@/lib/local-user";
import type { PackGender } from "@/lib/types";

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [name, setName] = useState("Anna");
  const [gender, setGender] = useState<PackGender>("FEMALE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const find = await fetch(`/api/join?code=${encodeURIComponent(code)}`);
      if (!find.ok) throw new Error("Code ungültig");
      const trip = await find.json();
      const local = ensureLocalUser();
      const user = {
        ...local,
        name: name || local.name,
        color: "#B45309",
        gender,
      };
      setLocalUser(user);

      const res = await fetch(`/api/trips/${trip.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code, user }),
      });
      if (!res.ok) throw new Error("Beitritt fehlgeschlagen");
      router.push(`/trip/${trip.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-stone-200 bg-white/80 p-6">
      <div>
        <Label>Invite-Code</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
        />
      </div>
      <div>
        <Label>Dein Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <GenderPicker value={gender} onChange={setGender} />
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
        Trip beitreten
      </h1>
      <p className="mb-8 mt-1 text-stone-600">
        Mit Invite-Code als Partner:in einsteigen und Shared Items live
        mitpacken.
      </p>
      <Suspense>
        <JoinForm />
      </Suspense>
    </main>
  );
}
