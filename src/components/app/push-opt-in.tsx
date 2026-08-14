"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Enable / disable Web Push for this device (all trip groups the user is in).
 */
export function PushOptInCard() {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [devices, setDevices] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    try {
      const res = await fetch("/api/push/subscribe");
      const data = await res.json();
      if (!res.ok) {
        setConfigured(false);
        return;
      }
      setConfigured(data.configured !== false);
      setSubscribed(Boolean(data.subscribed));
      setDevices(Number(data.devices) || 0);
    } catch {
      setConfigured(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMessage("Benachrichtigungen wurden blockiert.");
        return;
      }

      const vapidRes = await fetch("/api/push/vapid-public");
      const vapid = await vapidRes.json();
      if (!vapidRes.ok) throw new Error(vapid.error || "VAPID fehlt");

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      const json = sub.toJSON();

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");

      setSubscribed(true);
      setMessage("Dieses Gerät erhält Gruppen-Benachrichtigungen.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Aktivierung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      } else {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }
      setSubscribed(false);
      setMessage("Benachrichtigungen auf diesem Gerät aus.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-600">
        Push wird von diesem Browser nicht unterstützt. Auf dem iPhone: App zum
        Home-Bildschirm legen (iOS 16.4+).
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
        Push ist auf dem Server noch nicht konfiguriert (VAPID-Keys).
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50/40 px-3 py-3">
      <p className="text-sm font-semibold text-stone-900">
        Gruppen-Benachrichtigungen
      </p>
      <p className="text-xs text-stone-600">
        Meilensteine (50 %/100 %), Beitritte, Routenänderungen und neue Tipps —
        auf allen Geräten der Mitreisenden. Nicht bei jedem Abhaken.
      </p>
      <div className="flex flex-wrap gap-2">
        {!subscribed ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void enable()}
          >
            <Bell className="h-3.5 w-3.5" />
            {busy ? "…" : "Auf diesem Gerät aktivieren"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void disable()}
          >
            <BellOff className="h-3.5 w-3.5" />
            {busy ? "…" : "Deaktivieren"}
          </Button>
        )}
      </div>
      {subscribed && (
        <p className="text-xs text-teal-900">
          Aktiv{devices > 1 ? ` · ${devices} Geräte` : ""}
        </p>
      )}
      {message && <p className="text-xs text-stone-600">{message}</p>}
    </div>
  );
}
