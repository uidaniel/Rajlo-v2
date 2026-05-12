"use client";

/**
 * Capacitor / native bridge — a thin shim so the rest of the
 * codebase can stay platform-agnostic.
 *
 * Why a shim:
 *   - The same Next.js codebase runs on the web (rider portal, admin
 *     console, marketing site) AND inside the Capacitor driver shell.
 *   - Native plugins (BackgroundGeolocation, PushNotifications) crash
 *     hard if you call them from a regular browser. So we feature-
 *     detect with `isNativeApp()` and only invoke them when we know
 *     we're in the wrapper.
 *   - Tree-shaking is preserved via dynamic imports — the web build
 *     doesn't pull in any Capacitor plugin code.
 *
 * Usage:
 *   if (isNativeApp()) {
 *     const stop = await startBackgroundGeolocation(({ lat, lng }) => {
 *       sendFix(lat, lng);
 *     });
 *     return () => void stop();
 *   } else {
 *     // browser navigator.geolocation fallback
 *   }
 */

/**
 * Truthy only when the page is running inside the Capacitor WebView.
 * Capacitor exposes a global `Capacitor` object that the web build
 * never produces. We treat its presence as the single source of truth.
 *
 * SSR-safe: returns false on the server.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/**
 * Type of the position handler. Mirrors the `LivePosition` shape
 * used by useRidePosition so callers don't have to translate.
 */
export type NativePositionHandler = (pos: {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  ts: number;
}) => void;

/**
 * Start streaming position fixes from the native background-geolocation
 * plugin. Returns a cleanup function that stops the watcher.
 *
 * The plugin keeps GPS alive when the app is backgrounded or the screen
 * is locked, which `navigator.geolocation.watchPosition` cannot do —
 * THE reason we wrapped the driver app at all.
 *
 * Behavior:
 *   - First call prompts the OS permission dialog ("Always Allow" on
 *     iOS, "While using" + background prompt on Android).
 *   - If the driver denies, the returned cleanup is a no-op and an
 *     error is logged. Callers should fall back to browser geolocation
 *     in that case (degraded — only works while the app is foregrounded).
 *   - Caller is responsible for calling the cleanup when the trip ends
 *     to drop the sticky notification on Android + battery drain.
 *
 * Returns null if called on a non-native platform — never throws.
 */
export async function startBackgroundGeolocation(
  onFix: NativePositionHandler,
): Promise<(() => Promise<void>) | null> {
  if (!isNativeApp()) return null;

  try {
    // The community plugin is registered at runtime via Capacitor's
    // `registerPlugin` — it doesn't ship a pre-built plugin object.
    // Dynamic import keeps both `@capacitor/core` and the typings
    // out of the web bundle.
    const { registerPlugin } = await import("@capacitor/core");
    const BackgroundGeolocation = registerPlugin<
      import("@capacitor-community/background-geolocation").BackgroundGeolocationPlugin
    >("BackgroundGeolocation");

    const watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage:
          "Rajlo is sharing your location for an active trip.",
        backgroundTitle: "Rajlo Driver",
        requestPermissions: true,
        // Drop sub-10m jitter so we don't fire on standing-still
        // GPS noise. Matches the broadcast hook's dedupe threshold.
        distanceFilter: 10,
      },
      (location, error) => {
        if (error) {
          if (error.code === "NOT_AUTHORIZED") {
            // Driver denied permission. Log + bail.
            console.warn(
              "[native] background geolocation denied:",
              error.message,
            );
          }
          return;
        }
        if (!location) return;
        onFix({
          lat: location.latitude,
          lng: location.longitude,
          heading: typeof location.bearing === "number" ? location.bearing : null,
          speed: typeof location.speed === "number" ? location.speed : null,
          ts: location.time ?? Date.now(),
        });
      },
    );

    return async () => {
      try {
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
      } catch {
        /* watcher already gone */
      }
    };
  } catch (err) {
    console.error("[native] failed to start background geolocation:", err);
    return null;
  }
}

/**
 * Register the device for native push notifications and return the
 * Firebase Cloud Messaging token. Callers should hand the token off
 * to the existing push-subscriptions endpoint so the server can fan
 * out new-ride alerts to the driver even when the app is killed.
 *
 * Returns null on web or if registration fails.
 */
export async function registerNativePush(): Promise<string | null> {
  if (!isNativeApp()) return null;

  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return null;
    await PushNotifications.register();

    return new Promise((resolve) => {
      const onRegister = (token: { value: string }) => resolve(token.value);
      const onError = () => resolve(null);
      PushNotifications.addListener("registration", onRegister);
      PushNotifications.addListener("registrationError", onError);
      // Safety timeout — registration should fire within a few seconds.
      setTimeout(() => resolve(null), 15_000);
    });
  } catch (err) {
    console.error("[native] push registration failed:", err);
    return null;
  }
}
