const CACHE = "flexipack-v6";
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/push-pack.png",
  "/icons/push-team.png",
  "/icons/push-route.png",
  "/icons/push-tips.png",
  "/icons/push-card-pack.png",
  "/icons/push-card-team.png",
  "/icons/push-card-route.png",
  "/icons/push-card-tips.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache Next internals, APIs, or HTML navigations — stale chunks = blank app
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});

const MOTIF_FALLBACK = {
  pack: { icon: "/icons/push-pack.png", image: "/icons/push-card-pack.png" },
  team: { icon: "/icons/push-team.png", image: "/icons/push-card-team.png" },
  route: { icon: "/icons/push-route.png", image: "/icons/push-card-route.png" },
  tips: { icon: "/icons/push-tips.png", image: "/icons/push-card-tips.png" },
};

self.addEventListener("push", (event) => {
  let data = {
    title: "FlexiPack",
    body: "Update zu eurer Reise",
    url: "/",
    tag: "flexipack",
    motif: "pack",
    icon: "",
    image: "",
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) data.body = text;
    } catch {
      // ignore
    }
  }

  const fallback = MOTIF_FALLBACK[data.motif] || MOTIF_FALLBACK.pack;
  const icon = data.icon || fallback.icon || "/icons/icon-192.png";
  const image = data.image || fallback.image;

  event.waitUntil(
    self.registration.showNotification(data.title || "FlexiPack", {
      body: data.body,
      icon,
      badge: "/icons/icon-192.png",
      image,
      tag: data.tag || "flexipack",
      data: { url: data.url || "/", motif: data.motif || "pack" },
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client && client.url.includes(self.location.origin)) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
      })
  );
});
