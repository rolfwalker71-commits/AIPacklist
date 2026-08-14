"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenderPicker } from "@/components/ui/gender-picker";

type Gender = "FEMALE" | "MALE" | "UNSPECIFIED";

export function ProfileEditor({
  initial,
}: {
  initial: {
    name: string;
    gender: Gender;
    color: string;
    avatarUrl: string | null;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [gender, setGender] = useState<Gender>(initial.gender);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingAvatar) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingAvatar);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingAvatar]);

  const display = previewUrl || avatarUrl;

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      let nextAvatar = avatarUrl;

      if (pendingAvatar) {
        const body = new FormData();
        body.append("file", pendingAvatar);
        const res = await fetch("/api/avatars", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(
            typeof data.error === "string"
              ? data.error
              : "Avatar konnte nicht hochgeladen werden"
          );
          return;
        }
        nextAvatar = data.avatarUrl ?? nextAvatar;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), gender }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(
          typeof data.error === "string"
            ? data.error
            : "Profil konnte nicht gespeichert werden"
        );
        return;
      }

      setAvatarUrl(nextAvatar);
      setPendingAvatar(null);
      setMessage("Gespeichert");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (busy) return;
    if (pendingAvatar && !avatarUrl) {
      setPendingAvatar(null);
      setMessage(null);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/avatars", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(
          typeof data.error === "string"
            ? data.error
            : "Avatar konnte nicht entfernt werden"
        );
        return;
      }
      setAvatarUrl(null);
      setPendingAvatar(null);
      setMessage("Avatar entfernt");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Entfernen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div>
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <GenderPicker value={gender} onChange={setGender} />
      <div>
        <Label>Avatar</Label>
        <div className="mt-2 flex items-center gap-3">
          {display ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={display}
              alt=""
              className="h-16 w-16 rounded-2xl object-cover ring-1 ring-black/5"
            />
          ) : (
            <span
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-semibold text-white"
              style={{ background: initial.color }}
            >
              {(name || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="file"
              accept="image/*"
              className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setPendingAvatar(file);
                setMessage(
                  file
                    ? "Bild gewählt — tippe Speichern, damit es bleibt."
                    : null
                );
                e.target.value = "";
              }}
            />
            {(display || pendingAvatar) && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={busy}
                className="text-xs font-medium text-rose-700 hover:underline disabled:opacity-50"
              >
                Avatar entfernen
              </button>
            )}
          </div>
        </div>
      </div>
      {message && (
        <p
          className={`text-sm font-medium ${
            message === "Gespeichert" || message === "Avatar entfernt"
              ? "text-teal-800"
              : message.includes("gewählt")
                ? "text-amber-800"
                : "text-rose-700"
          }`}
        >
          {message}
        </p>
      )}
      <Button
        type="button"
        className="w-full"
        onClick={save}
        disabled={busy || !name.trim()}
      >
        {busy ? "Speichern…" : "Speichern"}
      </Button>
    </div>
  );
}
