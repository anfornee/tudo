const CACHE_NAME = "life-tracker-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { notification: { title: "Tudo", body: event.data?.text() } }; }
  const notification = payload.notification ?? payload.data ?? {};
  event.waitUntil(self.registration.showNotification(notification.title ?? "Tudo", {
    body: notification.body ?? "You have a bill reminder.",
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-48x48.png",
    data: { url: notification.url ?? payload.data?.url ?? "/bills" },
    tag: notification.tag ?? "tudo-bills",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/bills"));
});
