"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";

/**
 * Hardware back-button handler for the Capacitor driver app.
 *
 * Web browsers handle the gesture/system back themselves. Inside the
 * Capacitor WebView the OS-level back has to be intercepted or the
 * webview either does nothing (Android 13+) or exits the app on first
 * press from any screen — both feel broken to the driver.
 *
 * Behaviour:
 *   - On a top-level tab (bottom-nav home/trip/earnings/history/me)
 *     a back press goes to the Home tab. A second back press from
 *     Home exits the app (matches what every native Android app does).
 *   - Anywhere else, back navigates one step in the router history.
 *
 * No-op on the web (no Capacitor App plugin), so the marketing site
 * and rider portal keep their native browser back behavior.
 */

const TOP_LEVEL_PATHS = new Set([
  "/driver",
  "/driver/active-trip",
  "/driver/earnings",
  "/driver/history",
  "/driver/profile",
]);

const HOME_PATH = "/driver";
const DOUBLE_TAP_WINDOW_MS = 2000;

export function NativeBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  // The handler captures pathname/router via refs so the single
  // registered listener always reads the latest value — re-registering
  // the listener on every nav change would cause double-fires during
  // the transient overlap.
  const pathRef = useRef(pathname);
  const lastExitPressRef = useRef(0);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", () => {
          const current = pathRef.current ?? "";

          // Top-level tab → either bounce to Home, or exit on Home.
          if (TOP_LEVEL_PATHS.has(current)) {
            if (current === HOME_PATH) {
              const now = Date.now();
              if (now - lastExitPressRef.current < DOUBLE_TAP_WINDOW_MS) {
                void App.exitApp();
                return;
              }
              lastExitPressRef.current = now;
              return;
            }
            router.replace(HOME_PATH);
            return;
          }

          // Deeper page → step back. router.back() respects the
          // browser history stack inside the WebView, which is what
          // links and Next-router pushes populate.
          router.back();
        });
        if (cancelled) {
          void handle.remove();
        } else {
          cleanup = () => void handle.remove();
        }
      } catch {
        /* @capacitor/app not available — treat as web, no-op */
      }
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [router]);

  return null;
}
