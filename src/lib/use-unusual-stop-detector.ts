"use client";

import { useEffect, useRef } from "react";
import { haversineKm } from "./jamaica";

/**
 * Watch the live driver position during an in-progress trip and fire
 * a callback when the car has been stationary "too long".
 *
 * Heuristic:
 *   - "Stationary" = consecutive position pings all within
 *     `MOVEMENT_THRESHOLD_M` of each other (≈40 metres — generous
 *     enough to ignore GPS jitter at a red light, tight enough to
 *     catch a real stop).
 *   - "Too long" = the rolling stationary window is older than
 *     `STATIONARY_THRESHOLD_MS` (default 4 minutes).
 *
 * Only one fire per stop event. The next time the car moves >threshold,
 * we reset the timer; the next stop will fire again. This avoids
 * pestering the rider every minute they're stuck in Half Way Tree
 * traffic — they see the modal once per actual stop.
 *
 * Per design we DON'T fire if the trip status is anything other than
 * `in_progress`. A driver stopped at the pickup waiting for the rider
 * (`arrived` status) is normal; a driver stopped mid-trip isn't.
 */

const MOVEMENT_THRESHOLD_M = 40;
// 4 minutes — calibrated from real-world traffic: most red lights are
// under 2 minutes, longer stops typically mean either a side detour
// (drop another passenger, fuel stop) or something actually wrong.
const STATIONARY_THRESHOLD_MS = 4 * 60 * 1000;

export function useUnusualStopDetector({
  driverPosition,
  rideStatus,
  enabled,
  onUnusualStop,
}: {
  /** Latest broadcast driver position (or null while waiting). */
  driverPosition: { lat: number; lng: number; ts: number } | null;
  /** Current ride status — detector only runs during `in_progress`. */
  rideStatus: string | null | undefined;
  /** Master switch — pass `false` to disable entirely. */
  enabled: boolean;
  /** Fired when an unusual stop is detected (once per stop). The
   *  caller's responsibility to handle the alert + modal popup. */
  onUnusualStop: () => void;
}) {
  // Anchor — the position the car has been "stuck near" since. Lives
  // in a ref because flipping it on every new GPS ping doesn't need
  // to re-render anything; the detector is invisible to the UI until
  // it fires `onUnusualStop`. Refs sidestep the React 19
  // setState-in-effect lint rule entirely.
  const anchorRef = useRef<{ lat: number; lng: number; sinceMs: number } | null>(
    null,
  );
  // Track whether we've already fired the callback for the current
  // stop event so we don't fire on every subsequent ping.
  const firedForCurrentStopRef = useRef(false);

  useEffect(() => {
    if (!enabled || rideStatus !== "in_progress" || !driverPosition) {
      // Reset anchor when we exit in-progress so the next trip starts
      // with a clean slate.
      anchorRef.current = null;
      firedForCurrentStopRef.current = false;
      return;
    }

    const now = Date.now();
    const fixTs = driverPosition.ts ?? now;
    const pos = { lat: driverPosition.lat, lng: driverPosition.lng };

    if (!anchorRef.current) {
      anchorRef.current = { ...pos, sinceMs: fixTs };
      return;
    }

    const distanceM = haversineKm(anchorRef.current, pos) * 1000;

    if (distanceM > MOVEMENT_THRESHOLD_M) {
      // Real movement → reset anchor + clear the fired flag so the
      // next stop will trigger again.
      anchorRef.current = { ...pos, sinceMs: fixTs };
      firedForCurrentStopRef.current = false;
      return;
    }

    // We're still near the anchor. How long?
    const stationaryFor = now - anchorRef.current.sinceMs;

    if (
      stationaryFor >= STATIONARY_THRESHOLD_MS &&
      !firedForCurrentStopRef.current
    ) {
      firedForCurrentStopRef.current = true;
      onUnusualStop();
    }
  }, [driverPosition, rideStatus, enabled, onUnusualStop]);
}
