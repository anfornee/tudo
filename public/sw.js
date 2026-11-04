const STATIC_CACHE = "tudo-static-v2";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/tudo-logo-transparent.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                (key.startsWith("tudo-") || key.startsWith("life-tracker-")),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? Response.error();
      }),
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { title: "Tudo", body: event.data?.text() } };
  }

  const notification = payload.notification ?? payload.data ?? {};
  const url = notification.url ?? payload.data?.url ?? "/bills";

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(notification.title ?? "Tudo", {
        body: notification.body ?? "You have a bill reminder.",
        icon: "/icons/icon-192.png",
        badge: "/icons/favicon-48x48.png",
        data: { url },
        tag: notification.tag ?? `tudo-bills-${Date.now()}`,
      }),
      typeof self.navigator.setAppBadge === "function"
        ? self.navigator.setAppBadge()
        : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedDestination = new URL(
    event.notification.data?.url ?? "/bills",
    self.location.origin,
  );
  const destination =
    requestedDestination.origin === self.location.origin
      ? requestedDestination.href
      : new URL("/bills", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const existingClient = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );

        if (existingClient) {
          if ("navigate" in existingClient) {
            await existingClient.navigate(destination);
          }
          return existingClient.focus();
        }

        return self.clients.openWindow(destination);
      }),
  );
});
