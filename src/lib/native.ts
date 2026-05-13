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
 * Localstorage flag the gate writes after the driver successfully
 * grants location permission. Used to skip the readiness gate on
 * subsequent app launches without re-prompting.
 *
 * The `@capacitor-community/background-geolocation` plugin doesn't
 * expose a clean checkPermissions API, so we cache the grant locally.
 * If the user later revokes permission via Android Settings, the
 * watcher will fail with NOT_AUTHORIZED next time it tries to start
 * and we surface the error through the normal "permission denied"
 * path in useRidePosition.
 */
const LOCATION_GRANTED_KEY = "rajlo_native_location_granted";

/**
 * True if the driver has granted location permission at least once
 * before in this app install. Used by the readiness gate to skip the
 * "Allow location" step on app relaunch.
 */
export function hasNativeLocationBeenGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOCATION_GRANTED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Check the current OS-level push permission. Unlike location, the
 * @capacitor/push-notifications plugin DOES expose checkPermissions,
 * so we read the live state instead of caching. Returns true only if
 * the user has previously tapped Allow.
 *
 * Returns false on web (no native plugin).
 */
export async function checkNativePushPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );
    const result = await PushNotifications.checkPermissions();
    return result.receive === "granted";
  } catch {
    return false;
  }
}

/**
 * Register the device for native push notifications, POST the FCM/APNs
 * token to /api/push/subscribe so it's stored alongside web-push rows,
 * and return the token. After this resolves successfully the
 * `push_subscriptions` row exists and the server-side "must have push
 * to go online" gate passes.
 *
 * Returns:
 *   { token, platform }  — success
 *   null                  — web context, denied permission, or error
 */
export async function registerNativePush(): Promise<
  { token: string; platform: "android" | "ios" } | null
> {
  if (!isNativeApp()) return null;

  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("[native] push permission not granted:", perm.receive);
      return null;
    }

    // CRITICAL: attach listeners BEFORE calling register(). Capacitor
    // fires the `registration` event the moment Android returns an
    // FCM token, which can happen between `register()` resolving and
    // us getting a chance to attach a handler — race-condition city.
    // Attaching first guarantees we catch it.
    const tokenPromise = new Promise<string | null>((resolve) => {
      let resolved = false;
      const finish = (value: string | null) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };
      void PushNotifications.addListener("registration", (t) => {
        console.log(
          `[native] FCM registration token received (len=${t.value.length})`,
        );
        finish(t.value);
      });
      void PushNotifications.addListener("registrationError", (err) => {
        // Capacitor's console bridge stringifies objects as
        // "[object Object]" — JSON.stringify keeps the actual error
        // message visible in Logcat.
        console.error(
          "[native] FCM registration error: " +
            JSON.stringify(err, null, 2),
        );
        finish(null);
      });
      // 30s — Firebase token generation on a cold install can be slow
      // on flaky networks. Better to wait than fail too fast.
      setTimeout(() => {
        if (!resolved) {
          console.warn(
            "[native] FCM registration timed out after 30s — no token",
          );
        }
        finish(null);
      }, 30_000);
    });

    await PushNotifications.register();
    const token = await tokenPromise;
    if (!token) return null;

    // Detect platform from the Capacitor global. Defaults to android
    // if the lookup fails — iOS will return "ios" once we add the
    // iOS platform on a Mac.
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    const platform: "android" | "ios" =
      cap?.getPlatform?.() === "ios" ? "ios" : "android";

    // POST the token to the server so push_subscriptions has a row.
    // Failures here are why the readiness gate sometimes shows "all
    // green" yet pushes never arrive — surface them via console so
    // Logcat (or browser DevTools) shows exactly what went wrong.
    let res: Response | null = null;
    try {
      res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ platform, token }),
      });
    } catch (err) {
      console.error("[native] /api/push/subscribe network error:", err);
      return null;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[native] /api/push/subscribe failed: ${res.status} ${res.statusText}`,
        text.slice(0, 200),
      );
      // Treat as a failed registration so the gate doesn't show "ready"
      // when the server has no token to dispatch FCM to. The most
      // common cause is a missing/expired auth cookie (401) — which
      // is also what triggers the Capacitor cookie persistence bug.
      return null;
    }

    console.log(
      `[native] FCM token registered server-side (${platform})`,
    );
    return { token, platform };
  } catch (err) {
    console.error("[native] push registration failed:", err);
    return null;
  }
}

/**
 * Ask the OS for foreground + background location permission. Returns
 * true if the driver granted at least foreground location (the
 * minimum to use the GPS). Background is requested at the same time
 * but if the driver only granted "While Using" the watcher will
 * pause when the app is backgrounded — they'll get a degraded
 * experience but the app still works.
 *
 * No-op on web (returns true so the readiness gate doesn't block
 * web users — they have their own permission flow via the browser's
 * built-in geolocation prompt).
 */
export async function requestNativeLocationPermission(): Promise<boolean> {
  if (!isNativeApp()) return true;

  try {
    const { registerPlugin } = await import("@capacitor/core");
    const BackgroundGeolocation = registerPlugin<
      import("@capacitor-community/background-geolocation").BackgroundGeolocationPlugin
    >("BackgroundGeolocation");

    // The plugin doesn't have a standalone "request permission" method
    // — adding a watcher with `requestPermissions: true` prompts the
    // user, returns the watcher id once granted, then we immediately
    // remove the watcher so we're not draining battery just to ask.
    let watcherId: string | null = null;
    const granted = await new Promise<boolean>((resolve) => {
      let resolved = false;
      BackgroundGeolocation.addWatcher(
        {
          backgroundMessage:
            "Rajlo is sharing your location for an active trip.",
          backgroundTitle: "Rajlo Driver",
          requestPermissions: true,
        },
        (_pos, error) => {
          if (resolved) return;
          resolved = true;
          if (error) {
            resolve(false);
          } else {
            resolve(true);
          }
        },
      ).then((id) => {
        watcherId = id;
      });
      // Safety timeout — if neither callback fires within 30s assume
      // the user is sitting on the permission dialog and treat as
      // not-yet-granted. The gate will let them retry.
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 30_000);
    });

    // Stop the temporary watcher — the real one starts later from
    // useRidePosition when a trip is in flight.
    if (watcherId) {
      try {
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
      } catch {
        /* watcher already gone */
      }
    }

    if (granted) {
      // Cache the grant so the readiness gate skips this step on
      // subsequent app launches.
      try {
        window.localStorage.setItem(LOCATION_GRANTED_KEY, "1");
      } catch {
        /* localStorage unavailable — fall through, gate will re-ask */
      }
    }

    return granted;
  } catch (err) {
    console.error("[native] location permission request failed:", err);
    return false;
  }
}
