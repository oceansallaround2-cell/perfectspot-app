/* Perfect Spot — app-shell cache + push notifications. No offline data caching. */

const SHELL_CACHE = "ps-shell-v1";
const SHELL_ASSETS = ["/manifest.webmanifest", "/favicon.png", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];
const host = self.location.hostname;
const IS_PREVIEW =
  host === "localhost" ||
  host.startsWith("id-preview--") ||
  host.startsWith("preview--") ||
  /(^|\.)lovableproject(-dev)?\.com$/.test(host) ||
  /(^|\.)beta\.lovable\.dev$/.test(host);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (IS_PREVIEW ? Promise.resolve() : caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ps-shell-") && (IS_PREVIEW || k !== SHELL_CACHE)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (event) => {
  if (IS_PREVIEW) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn")) return;

  // Pages: always network first, fall back to cached shell if the network fails.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }

  // Hashed build assets + static icons: cache first.
  if (url.pathname.startsWith("/assets/") || SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "Perfect Spot", body: "Something new 💜", link: "/dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: payload.tag || undefined,
      data: { link: payload.link || "/dashboard" },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/dashboard";
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
