"use client";

import { useEffect, useRef } from "react";

/**
 * Watches the driver's location permission state during an active
 * trip. If location is turned off (permission revoked OR the OS
 * stops returning fixes), this fires:
 *
 *   1. A short vibration pulse on the phone (Android only — iOS
 *      browsers don't expose `navigator.vibrate`)
 *   2. A POST to /api/driver/violations/report which records the
 *      violation server-side and, on the 2nd unresolved violation,
 *      auto-deactivates the driver
 *
 * Why a hook and not server-side detection? The server only sees
 * driver positions when the client pushes them. Detecting "client
 * stopped pushing" server-side has too many false positives
 * (network blip, app closed, normal heartbeat lapse). The driver's
 * own device knows immediately when the user toggles location off,
 * so the report originates there.
 *
 * Dedup is enforced server-side via a 5-minute window per kind.
 */

const CHECK_INTERVAL_MS = 10_000;
/** Pulse length the vibration plays. 600ms pattern: 200ms on, 100
 *  off, 200 on, 100 off, 400 on — long enough to feel in a pocket. */
const VIBE_PATTERN = [200, 100, 200, 100, 400];

export function useLocationViolationMonitor({
  rideId,
  rideStatus,
  enabled,
}: {
  rideId: string | null;
  rideStatus: string | null | undefined;
  /** Master switch — false in dev or when the trip isn't in-flight. */
  enabled: boolean;
}) {
  // Track whether we've already reported a violation for this trip
  // so we don't spam the endpoint on every interval. Reset when
  // permission flips back on.
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (rideStatus !== "in_progress") return;
    if (!rideId) return;
    if (typeof navigator === "undefined") return;

    let cancelled = false;

    const checkOnce = async () => {
      if (cancelled) return;
      // Two signals that location is off:
      //   1. Permissions API says denied
      //   2. getCurrentPosition fails with PERMISSION_DENIED (Android
      //      sometimes reports the permission as granted but the OS-
      //      level location service is off — we have to actually try
      //      a fix to know).
      let denied = false;

      try {
        if ("permissions" in navigator) {
          const status = await (
            navigator.permissions as Permissions
          ).query({ name: "geolocation" as PermissionName });
          if (status.state === "denied") denied = true;
        }
      } catch {
        /* Permissions API unavailable — fall through to the fix check */
      }

      if (!denied) {
        // Try a fix with a tight timeout. If it errors with
        // PERMISSION_DENIED or POSITION_UNAVAILABLE (location services
        // disabled at the OS level), treat as denied.
        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              (err) => reject(err),
              {
                enableHighAccuracy: false,
                maximumAge: 60_000,
                timeout: 5_000,
              },
            );
          });
        } catch (err) {
          const code = (err as GeolocationPositionError | null)?.code;
          // 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE,
          // 3=TIMEOUT (treat timeout as transient, not denial)
          if (code === 1 || code === 2) denied = true;
        }
      }

      if (denied && !reportedRef.current) {
        reportedRef.current = true;
        // Buzz the phone. Pattern is non-destructive on iOS (silent
        // no-op) so we can fire-and-forget.
        try {
          if ("vibrate" in navigator) {
            navigator.vibrate(VIBE_PATTERN);
          }
        } catch {
          /* user-gesture-required on some browsers — ignore */
        }
        // Best-effort POST. Server dedups + decides whether to
        // deactivate. We surface no UI ourselves — the push
        // notification the server fires is the user-facing signal.
        void fetch("/api/driver/violations/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "location_off_mid_trip",
            rideId,
            details: `Trip ${rideId.slice(0, 8)} — location revoked during in_progress`,
          }),
        }).catch(() => null);
      } else if (!denied) {
        // Location came back on — reset so a future drop also fires.
        reportedRef.current = false;
      }
    };

    // Immediate check + interval.
    void checkOnce();
    const timer = setInterval(checkOnce, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      reportedRef.current = false;
    };
  }, [enabled, rideId, rideStatus]);
}
