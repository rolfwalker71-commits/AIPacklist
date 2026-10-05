import webpush from "web-push";
import { prisma } from "@/lib/db";
import { apnsConfigured, sendApns, type ApnsEnvironment } from "@/lib/apns";

export type PushMotif = "pack" | "team" | "route" | "tips";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Motif card art for notification icon + large image (Android). */
  motif?: PushMotif;
};

const MOTIF_ASSETS: Record<PushMotif, { icon: string; image: string }> = {
  pack: {
    icon: "/icons/push-pack.png",
    image: "/icons/push-card-pack.png",
  },
  team: {
    icon: "/icons/push-team.png",
    image: "/icons/push-card-team.png",
  },
  route: {
    icon: "/icons/push-route.png",
    image: "/icons/push-card-route.png",
  },
  tips: {
    icon: "/icons/push-tips.png",
    image: "/icons/push-card-tips.png",
  },
};

function vapidConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim()
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return vapidConfigured();
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:flexipack@localhost",
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );
  vapidReady = true;
  return true;
}

/** Send a push to every device of every trip member: web push (PWA) and native iOS push (APNs). */
export async function notifyTripMembers(
  tripId: string,
  payload: PushPayload,
  opts?: { excludeUserId?: string }
) {
  const webReady = ensureVapid();
  const apnsReady = apnsConfigured();
  if (!webReady && !apnsReady) {
    return { sent: 0, skipped: "not-configured" as const };
  }

  const members = await prisma.tripMember.findMany({
    where: { tripId },
    select: { userId: true },
  });
  const userIds = members
    .map((m) => m.userId)
    .filter((id) => id !== opts?.excludeUserId);
  if (!userIds.length) return { sent: 0 };

  const [web, native] = await Promise.all([
    webReady
      ? sendWebPush(tripId, userIds, payload)
      : Promise.resolve({ sent: 0 }),
    apnsReady
      ? sendNativePush(tripId, userIds, payload)
      : Promise.resolve({ sent: 0 }),
  ]);
  return { sent: web.sent + native.sent, web: web.sent, native: native.sent };
}

async function sendNativePush(
  tripId: string,
  userIds: string[],
  payload: PushPayload
) {
  const devices = await prisma.apnsDevice.findMany({
    where: { userId: { in: userIds } },
  });
  if (!devices.length) return { sent: 0 };

  const results = await Promise.all(
    devices.map(async (d) => ({
      id: d.id,
      result: await sendApns(d.token, d.environment as ApnsEnvironment, {
        title: payload.title,
        body: payload.body,
        collapseId: payload.tag || `trip-${tripId}`,
        threadId: `trip-${tripId}`,
        data: { tripId, url: payload.url || `/trip/${tripId}` },
      }),
    }))
  );

  const stale = results.filter((r) => r.result === "stale").map((r) => r.id);
  if (stale.length) {
    await prisma.apnsDevice.deleteMany({ where: { id: { in: stale } } });
  }
  return { sent: results.filter((r) => r.result === "sent").length };
}

async function sendWebPush(
  tripId: string,
  userIds: string[],
  payload: PushPayload
) {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (!subs.length) return { sent: 0 };

  const motif = payload.motif || "pack";
  const assets = MOTIF_ASSETS[motif];

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || `/trip/${tripId}`,
    tag: payload.tag || `trip-${tripId}`,
    motif,
    icon: assets.icon,
    image: assets.image,
  });

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 12 }
        );
        sent += 1;
      } catch (e) {
        const status =
          e && typeof e === "object" && "statusCode" in e
            ? Number((e as { statusCode: number }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          stale.push(sub.id);
        }
      }
    })
  );

  if (stale.length) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: stale } },
    });
  }

  return { sent };
}

/** Debounced route-change pushes (multiple leg edits → one notification). */
const routePushTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleRoutePush(
  tripId: string,
  title: string,
  actorName?: string
) {
  const prev = routePushTimers.get(tripId);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    routePushTimers.delete(tripId);
    void notifyTripMembers(tripId, {
      title: title.slice(0, 60),
      body: actorName
        ? `${actorName} hat die Route aktualisiert.`
        : "Die Route wurde aktualisiert.",
      url: `/trip/${tripId}?tab=legs`,
      tag: `route-${tripId}`,
      motif: "route",
    });
  }, 30_000);
  routePushTimers.set(tripId, timer);
}
