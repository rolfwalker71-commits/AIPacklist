"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminUser = {
  id: string;
  name: string;
  username: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  color: string;
  _count?: { memberships: number; ownedTrips: number };
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Keine Berechtigung");
      return;
    }
    setUsers(data.users || []);
    setError(null);
  }, []);

  useEffect(() => {
    load().catch(() => setError("Laden fehlgeschlagen"));
  }, [load]);

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setName("");
      setUsername("");
      setPassword("");
      setRole("USER");
      setMessage(`Benutzer «${data.user.username}» angelegt.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const patchUser = async (userId: string, body: Record<string, unknown>) => {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Update fehlgeschlagen");
      return;
    }
    setMessage("Gespeichert.");
    await load();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <Link href="/" className="text-sm font-semibold text-teal-800">
        ← FlexiPack
      </Link>
      <h1 className="mt-4 font-display text-3xl text-stone-950">
        Benutzerverwaltung
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Geschlossene Konten: nur hier anlegen. Jeder User hat eigene Trips und
        kann Partner:innen per Einladungscode zu einem Trip holen.
      </p>

      {(error || message) && (
        <p
          className={`mt-4 text-sm ${error ? "text-rose-700" : "text-teal-800"}`}
        >
          {error || message}
        </p>
      )}

      <form
        onSubmit={createUser}
        className="mt-8 space-y-3 rounded-2xl border border-stone-200 bg-white/80 p-4"
      >
        <h2 className="font-semibold text-stone-900">Neuen Benutzer anlegen</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Benutzername</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Passwort</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div>
            <Label>Rolle</Label>
            <select
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
            >
              <option value="USER">Benutzer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Anlegen…" : "Benutzer anlegen"}
        </Button>
      </form>

      <ul className="mt-8 space-y-3">
        {users.map((u) => (
          <li
            key={u.id}
            className="rounded-2xl border border-stone-200 bg-white/80 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-stone-900">
                  {u.name}{" "}
                  <span className="text-stone-400">@{u.username}</span>
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {u.role === "ADMIN" ? "Admin" : "Benutzer"} ·{" "}
                  {u.isActive ? "aktiv" : "deaktiviert"} ·{" "}
                  {u._count?.ownedTrips ?? 0} eigene Trips ·{" "}
                  {u._count?.memberships ?? 0} Mitgliedschaften
                </div>
              </div>
              <span
                className="mt-1 h-3 w-3 rounded-full"
                style={{ background: u.color }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => patchUser(u.id, { isActive: !u.isActive })}
              >
                {u.isActive ? "Deaktivieren" : "Aktivieren"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const pw = window.prompt(
                    `Neues Passwort für ${u.username} (min. 8 Zeichen):`
                  );
                  if (pw && pw.length >= 8) patchUser(u.id, { password: pw });
                  else if (pw) setError("Passwort zu kurz.");
                }}
              >
                Passwort setzen
              </Button>
              {u.role !== "ADMIN" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => patchUser(u.id, { role: "ADMIN" })}
                >
                  Zum Admin machen
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
