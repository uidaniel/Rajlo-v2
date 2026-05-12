"use client";

import { useEffect, useMemo, useRef } from "react";
import { decodePolyline, distanceToPolylineM, type LatLng } from "./polyline";

/**
 * Watches the live driver position during an in-progress trip and
 * fires a callback when the car has been substantially off the planned
 * Google Directions polyline "for too long".
 *
 * Heuristic:
 *   - "Off-route"   = perpendicular distance from current position to
 *                     the nearest segment of the planned polyline
 *                     exceeds `OFF_ROUTE_THRESHOLD_M` (300m). 300m
 *                     gives enough slack for legitimate route variants
 *                     within the same corridor without firing on every
 *                     parallel street.
 *   - "Too long"    = the driver has been continuously off-route for
 *                     `SUSTAINED_OFF_ROUTE_MS` (2 minutes). A quick
 *                     detour to dodge an accident shouldn't fire the
 *                     alert; a sustained deviation should.
 *
 * Only one fire per off-route event — once the driver returns within
 * threshold for any single ping the timer resets, so the next sustained
 * deviation will fire again.
 *
 * Per design we DON'T fire while the trip status is anything other
 * than `in_progress`. A driver going off-route during pickup approach
 * is just navigation choice; we only care about deviation *with the
 * rider on board*.
 *
 * Refs-only — never calls setState. The detector is invisible to the
 * UI until it fires `onOffRoute`, and refs sidestep React 19's
 * setState-in-effect lint entirely.
 */

const OFF_ROUTE_THRESHOLD_M = 300;
const SUSTAINED_OFF_ROUTE_MS = 2 * 60 * 1000;

export function useOffRouteDetector({
  driverPosition,
  rideStatus,
  plannedPolyline,
  enabled,
  onOffRoute,
}: {
  /** Latest broadcast driver position (null until first ping). */
  driverPosition: { lat: number; lng: number; ts: number } | null;
  /** Current ride status — detector only runs during `in_progress`. */
  rideStatus: string | null | undefined;
  /** Encoded Google Directions polyline (algorithm 1, precision 5).
   *  Null means we don't yet have a planned route — detector is a
   *  no-op until one arrives. */
  plannedPolyline: string | null;
  /** Master switch — pass `false` to disable entirely. */
  enabled: boolean;
  /** Fired once per sustained off-route event. The caller's job to
   *  handle alert creation + modal popup. */
  onOffRoute: () => void;
}) {
  // Decode the polyline once per change — decoding is cheap (<1ms for
  // a typical Kingston→Mandeville route) but no point doing it on every
  // GPS ping.
  const decoded = useMemo<LatLng[]>(() => {
    if (!plannedPolyline) return [];
    try {
      return decodePolyline(plannedPolyline);
    } catch {
      return [];
    }
  }, [plannedPolyline]);

  // When did the driver first cross out of the corridor in this run?
  // Null = currently on route, or no data yet.
  const offSinceMsRef = useRef<number | null>(null);
  // Track whether we've already fired the callback for the current
  // off-route event so we don't fire on every subsequent ping.
  const firedForCurrentEventRef = useRef(false);

  useEffect(() => {
    // Disabled / wrong status / no polyline / no position — reset and bail.
    if (
      !enabled ||
      rideStatus !== "in_progress" ||
      decoded.length < 2 ||
      !driverPosition
    ) {
      offSinceMsRef.current = null;
      firedForCurrentEventRef.current = false;
      return;
    }

    const distM = distanceToPolylineM(
      { lat: driverPosition.lat, lng: driverPosition.lng },
      decoded,
    );

    if (distM <= OFF_ROUTE_THRESHOLD_M) {
      // Back on route — reset the timer and the fired flag so the next
      // sustained deviation will fire again.
      offSinceMsRef.current = null;
      firedForCurrentEventRef.current = false;
      return;
    }

    // We're off-route. Start the clock if it isn't running.
    const now = Date.now();
    if (offSinceMsRef.current === null) {
      offSinceMsRef.current = now;
      return;
    }

    const offFor = now - offSinceMsRef.current;
    if (
      offFor >= SUSTAINED_OFF_ROUTE_MS &&
      !firedForCurrentEventRef.current
    ) {
      firedForCurrentEventRef.current = true;
      onOffRoute();
    }
  }, [driverPosition, rideStatus, enabled, decoded, onOffRoute]);
}
