"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp, setupNotificationChannels } from "@/lib/native";

/**
 * Capacitor-only side-effects component, mounted once in the root
 * layout. Two responsibilities:
 *
 *   1. Create the high-importance "rajlo_alerts" notification channel
 *      so server-sent FCM messages pop up as heads-up banners instead
 *      of silently landing in the tray.
 *
 *   2. Listen for notification taps and route the driver to the
 *      relevant page. The FCM payload carries a `url` field set
 *      server-side; we just push it onto Next.js's router.
 *
 * On the web this is a no-op so non-native users see no change.
 */
export function NativePushHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    let removeAction: (() => Promise<void>) | null = null;
    let cancelled = false;

    (async () => {
      // 1. Make sure the channel exists before any FCM arrives.
      await setupNotificationChannels();
      if (cancelled) return;

      // 2. Wire deep-linking. The server pushes `data: { url: "/driver/active-trip" }`
      // (or similar) on every notification; this handler runs when the
      // user taps the notification — both when the app was in the
      // background and when it was cold-started.
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );
      const handle = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const data = action.notification.data ?? {};
          const url =
            typeof data.url === "string"
              ? data.url
              : typeof data["gcm.notification.url"] === "string"
                ? data["gcm.notification.url"]
                : null;
          if (!url) return;
          // Use `replace` so the back button doesn't return to the
          // pre-notification page — usually they were on the dashboard
          // and we just routed them to a chat or trip page.
          try {
            router.replace(url);
          } catch {
            // Router not ready (rare) — fall back to a hard navigation.
            if (typeof window !== "undefined") {
              window.location.href = url;
            }
          }
        },
      );
      removeAction = async () => {
        try {
          await handle.remove();
        } catch {
          /* listener already gone */
        }
      };
    })();

    return () => {
      cancelled = true;
      if (removeAction) void removeAction();
    };
  }, [router]);

  return null;
}
