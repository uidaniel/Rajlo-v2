"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();

  // Hardware Android back button — Capacitor surfaces it on the App
  // plugin. Default behavior (do nothing OR minimize the app) is
  // jarring inside a WebView. We want browser-like semantics: go
  // back in history if there's anything to go back to, otherwise
  // exit the app when at the root dashboard. Without this, the back
  // button feels broken — a Play Store reject in a review reviewer's
  // eyes and a guaranteed 1-star review from regular users.
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", async (event) => {
          // `canGoBack` reflects the WebView's browser-style history
          // stack. True when the user has navigated forward from the
          // initial route; false when they're at the entry point.
          if (event.canGoBack) {
            router.back();
            return;
          }
          // We're at the WebView's history root. If the user is on
          // the driver dashboard, exiting feels right. If they're
          // somewhere unexpected (a deep page they landed on via a
          // notification, an auth page), pop them back to /driver
          // instead of quitting outright — less surprising.
          if (pathname === "/driver" || pathname === "/") {
            await App.exitApp();
          } else {
            router.replace("/driver");
          }
        });
        remove = async () => {
          try {
            await handle.remove();
          } catch {
            /* listener already gone */
          }
        };
      } catch {
        /* App plugin missing — fall back to system default behaviour */
      }
    })();
    return () => {
      if (remove) void remove();
    };
  }, [router, pathname]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let removeAction: (() => Promise<void>) | null = null;
    let cancelled = false;

    (async () => {
      // 0. Drop the native splash the moment React paints. The
      // splash config has a 2.5s safety ceiling but on a warm cache
      // the WebView is usually ready well before then; hiding
      // explicitly here cuts the perceived load by 1-2 seconds.
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        void SplashScreen.hide({ fadeOutDuration: 200 });
      } catch {
        /* plugin missing — fall through, splash auto-hides on the ceiling */
      }

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
