"use client";

import { useEffect, useRef, useState } from "react";
import { isIOS } from "./platform-detect";

/**
 * Minimal "watch my own GPS into local state" hook.
 *
 * Use this on pages that need to render the user's own marker on a
 * map but don't need to broadcast that position to anyone (e.g. the
 * route-taxi rider page — driver position arrives via DB polling, so
 * a realtime channel for the rider's coords would be pure overhead).
 *
 * For two-way streaming (rider <-> driver position on private rides)
 * use `useRidePosition` instead — it wraps a Supabase Realtime channel.
 *
 * @param active  pass `false` to disable the watch entirely.
 */
export type SelfPosition = {
  lat: number;
  lng: number;
  heading: number | null;
  ts: number;
};

export function useSelfGpsPosition(active: boolean): {
  position: SelfPosition | null;
  error: string | null;
} {
  const [position, setPosition] = useState<SelfPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track the last sent fix in a ref so the dedupe runs against the
  // most recent value without rerunning the effect on every update.
  const lastRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      // No setState directly here — React 19 flags it. Defer via
      // microtask so the rule is satisfied and the message still
      // reaches the UI.
      queueMicrotask(() =>
        setError("Your browser doesn't support live location."),
      );
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next: SelfPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading:
            typeof pos.coords.heading === "number" &&
            !Number.isNaN(pos.coords.heading)
              ? pos.coords.heading
              : null,
          ts: Date.now(),
        };
        // Skip near-duplicate (~5m drift) so we don't re-render on
        // every micro-tremble of the GPS chip.
        const last = lastRef.current;
        if (
          last &&
          Math.abs(last.lat - next.lat) < 0.00005 &&
          Math.abs(last.lng - next.lng) < 0.00005
        ) {
          return;
        }
        lastRef.current = { lat: next.lat, lng: next.lng };
        setPosition(next);
      },
      (err) => {
        // iOS users hit "denied" most often and the fix is in iOS
        // Settings, not browser settings.
        if (err.code === 1) {
          setError(
            isIOS()
              ? "Location is blocked. Open Settings → Privacy & Security → Location Services → Safari Websites → While Using the App, then refresh."
              : "Location access is blocked. Allow location for Rajlo in your browser's site settings, then refresh.",
          );
        } else if (err.code === 2) {
          setError("Couldn't determine your location. Try moving outside or to a window.");
        } else if (err.code === 3) {
          setError("Location request timed out. Try again.");
        } else {
          setError("Live location failed.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      lastRef.current = null;
    };
  }, [active]);

  return { position, error };
}
