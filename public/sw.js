/**
 * Rajlo service worker — receives web push notifications when the
 * site is closed and surfaces them as system-level notifications.
 *
 * Scope: served from /sw.js so it covers the whole origin.
 *
 * Push payload shape (sent by the server in `src/lib/push.ts`):
 *   {
 *     title: string,
 *     body: string,
 *     icon?: string,       // small image (192x192 ideal)
 *     badge?: string,      // monochrome silhouette (Android tray)
 *     image?: string,      // hero image inside the notification
 *     url?: string,        // opened on click
 *     tag?: string,        // dedup key — newer push with same tag replaces older
 *     renotify?: boolean,  // re-buzz even if same tag
 *     actions?: Array<{ action: string; title: string }>,
 *     data?: Record<string, unknown>
 *   }
 */

self.addEventListener("install", () => {
  // New service worker should activate immediately on install — no
  // "wait until all tabs close" delay. Keeps deploys snappy.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of any existing tabs that haven't reloaded yet.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Not all platforms send JSON — fall back to raw text.
    payload = { title: "Rajlo", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Rajlo";
  const options = {
    body: payload.body || "",
    // PNG fallback for notification icons — OS notification panels
    // sometimes render PNG more reliably than SVG. The `/rajlo
    // favicon.png` file is served from the public folder.
    icon: payload.icon || "/rajlo%20favicon.png",
    badge: payload.badge || "/rajlo%20favicon.png",
    image: payload.image,
    tag: payload.tag,
    renotify: !!payload.renotify,
    data: {
      url: payload.url || "/",
      ...(payload.data || {}),
    },
    actions: Array.isArray(payload.actions) ? payload.actions : [],
    requireInteraction: !!payload.requireInteraction,
    vibrate: payload.vibrate || [80, 60, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  // If a Rajlo tab is already open, focus it and navigate; otherwise open
  // a fresh tab. This avoids spawning duplicate tabs every push.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(targetUrl);
            }
            return undefined;
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // The browser rotated the subscription keys (rare — happens after
  // browser updates or push-service migrations). We re-subscribe with
  // the same VAPID key. The next /api/push/subscribe call from the
  // page will overwrite the stale row server-side.
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription
          ? event.oldSubscription.options.applicationServerKey
          : undefined,
      })
      .then(() => {
        // The page-side hook polls subscription state on focus and
        // re-syncs with the server, so we don't post to the server
        // from here — keeps the worker stateless.
      }),
  );
});
