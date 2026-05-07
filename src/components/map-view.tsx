"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";
import { JAMAICA_CENTER, type Place } from "@/lib/jamaica";

/**
 * Branded Google Map showing pickup → stops → dropoff with red markers and a
 * polyline that follows actual roads via the Directions API. Auto-fits to
 * the route whenever the points change. Falls back to a straight-line
 * preview if Directions fails (e.g. impossible route, API hiccup).
 */

const MAP_STYLE: google.maps.MapTypeStyle[] = [
  // Soft, low-contrast base so the route + markers pop. Branded subtly.
  { elementType: "geometry", stylers: [{ color: "#f3f1ed" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b6068" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#d8d4cc" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", stylers: [{ visibility: "on" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dde8d8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#fbe9e9" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#f10100" }, { weight: 0.4 }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe6ec" }] },
];

export type LiveDot = { lat: number; lng: number };

/** A nearby online driver shown as a car icon on the booking-screen map. */
export type FleetDot = {
  driverId: string;
  lat: number;
  lng: number;
  /** Optional heading in degrees — rotates the car icon when present. */
  heading?: number | null;
};

/**
 * "Live route" mode — when set, the polyline goes from the driver's
 * current GPS position to the named target instead of the static
 * pickup → stops → dropoff path. Used during an active ride: while
 * heading to the rider, target is "pickup"; once the ride starts,
 * target flips to "dropoff".
 */
export type LiveRoute = { target: "pickup" | "dropoff" };

/** Re-route only when the driver has moved this many metres from the
 *  last route's origin. Without this, every 5s GPS heartbeat would fire
 *  a Directions API call — expensive and visually noisy (the polyline
 *  would flicker as it redraws). */
const LIVE_ROUTE_REFRESH_THRESHOLD_M = 120;

/** Initial compass bearing from p1 to p2 (0–360°, 0=north, clockwise). */
function computeBearing(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(p1.lat);
  const φ2 = toRad(p2.lat);
  const Δλ = toRad(p2.lng - p1.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Great-circle distance between two lat/lng pairs (haversine, metres). */
function approxDistanceMeters(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(p1.lat);
  const φ2 = toRad(p2.lat);
  const Δφ = toRad(p2.lat - p1.lat);
  const Δλ = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Top-down (elevation) view car icon. Rendered as an inline SVG embedded
// as a data URL — multi-element so we get a proper car look: red body,
// dark windshield + rear window, wing mirror nubs.
//
// Rotation is achieved by wrapping the car body in a `<g transform="rotate(...)">`
// and varying the rotation in the SVG source itself. The classic Google
// Maps `Marker` API doesn't rotate URL-based icons, so we encode the
// rotation directly into the SVG and produce a different data URL per
// rotation bucket. We bucket to 10° steps so we end up with ≤36 cached
// SVGs total no matter how many drivers, no matter how often they move.
function carIconSvg(rotationDeg: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60"><g transform="rotate(${rotationDeg} 20 30)"><path d="M12 4 Q8 4 8 8 L8 50 Q8 54 12 54 L28 54 Q32 54 32 50 L32 8 Q32 4 28 4 Z" fill="#f10100" stroke="#1a1a1a" stroke-width="1.5"/><path d="M11 13 L29 13 L26 21 L14 21 Z" fill="#1a1a1a" opacity="0.7"/><path d="M14 35 L26 35 L29 43 L11 43 Z" fill="#1a1a1a" opacity="0.7"/><rect x="5.5" y="15" width="3" height="3" rx="1" fill="#1a1a1a"/><rect x="31.5" y="15" width="3" height="3" rx="1" fill="#1a1a1a"/><line x1="20" y1="22" x2="20" y2="34" stroke="#1a1a1a" stroke-width="0.6" opacity="0.5"/></g></svg>`;
}

export function MapView({
  pickup,
  stops,
  dropoff,
  driverPosition,
  riderPosition,
  nearbyDrivers,
  liveRoute,
  className = "h-72 w-full",
}: {
  pickup: Place | null;
  stops: Place[];
  dropoff: Place | null;
  /** Live driver location (broadcast via Supabase Realtime). */
  driverPosition?: LiveDot | null;
  /** Live rider location (broadcast via Supabase Realtime). */
  riderPosition?: LiveDot | null;
  /** Online drivers on the booking-screen map (Phase 2A.4). */
  nearbyDrivers?: FleetDot[];
  /** When set, the polyline goes driver→pickup or driver→dropoff
   *  depending on `target`, and the driver marker is the car icon. */
  liveRoute?: LiveRoute | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  // Static polyline (pickup → stops → dropoff). Hidden when `liveRoute`
  // is engaged — the live route has its own polyline.
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  // Live route polyline (driver → target). Tracked separately so the
  // static-route effect doesn't accidentally clear it on every status flip.
  const livePolylineRef = useRef<google.maps.Polyline | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  // Live-position markers are tracked separately so they don't get wiped
  // when the route refreshes.
  const driverDotRef = useRef<google.maps.Marker | null>(null);
  const riderDotRef = useRef<google.maps.Marker | null>(null);
  // Driver heading state — derived from successive driverPosition values.
  // Held in refs so the marker effect can update icon rotation without
  // re-running the whole effect just because the heading number changed.
  const prevDriverPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const driverHeadingRef = useRef<number>(0);
  const driverIconBucketRef = useRef<number>(-1);
  // Live-route bookkeeping — we only refetch the Directions polyline
  // when the driver has drifted significantly OR the target has flipped.
  // Without this, the 5s GPS heartbeat would fire a Directions call
  // every tick, which is wasteful and makes the polyline flicker.
  const liveRouteOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const liveRouteTargetRef = useRef<"pickup" | "dropoff" | null>(null);
  // Fleet markers — keyed by driverId so we move/dispose them in place
  // instead of recreating every render. Smoother and avoids the
  // marker-creation flash when positions update. We also remember each
  // marker's current rotation bucket so we only call setIcon when the
  // heading actually changes — setIcon swaps the data URL and forces an
  // image re-decode, so we want to skip it whenever possible.
  const fleetMarkersRef = useRef<
    Map<string, { marker: google.maps.Marker; iconBucket: number }>
  >(new Map());
  // Surfaced if loadGoogleMaps rejects — gives the user something visible
  // instead of an opaque blank rectangle (the most common cause is API key
  // referrer restrictions not allowing the host the browser is on).
  const [loadError, setLoadError] = useState<string | null>(null);

  // Init map + DirectionsService once. We retry once on a small delay if
  // the container isn't sized yet — that happens on iOS Safari when the
  // map is rendered inside a sliding/transitioning ancestor.
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled) return;
        const el = containerRef.current;
        if (!el) return;

        // If the container has 0 width on mount (some flex/animation
        // ancestors collapse momentarily), wait one frame then retry.
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          retryTimer = setTimeout(init, 80);
          return;
        }

        mapRef.current = new g.maps.Map(el, {
          center: JAMAICA_CENTER,
          zoom: 9,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          styles: MAP_STYLE,
        });
        directionsServiceRef.current = new g.maps.DirectionsService();
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        // eslint-disable-next-line no-console
        console.error("[MapView] Google Maps failed to load:", msg);
        setLoadError(msg);
      }
    };
    init();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  // Re-render markers + (optionally) static route + bounds whenever the
  // waypoints change. When `liveRoute` is engaged, we still draw the
  // pickup/stops/dropoff markers, but skip the static polyline + bounds
  // — the live-route effect below owns those.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (typeof window === "undefined" || !window.google) return;

    // Wipe previous overlays.
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylineRef.current?.setMap(null);
    polylineRef.current = null;

    const points: { place: Place; label: string }[] = [];
    if (pickup) points.push({ place: pickup, label: "A" });
    stops.forEach((s, i) =>
      points.push({ place: s, label: String.fromCharCode(66 + i) }),
    );
    if (dropoff)
      points.push({
        place: dropoff,
        label: String.fromCharCode(65 + 1 + stops.length),
      });

    if (points.length === 0) {
      map.setCenter(JAMAICA_CENTER);
      map.setZoom(9);
      return;
    }

    // Drop the markers immediately — they don't depend on the route call.
    // While `liveRoute` is active we drop the pickup pin too while
    // in_progress (the rider has already been picked up; that pin would
    // be stale clutter). The dropoff stays visible as the destination.
    points.forEach(({ place, label }, i) => {
      const isPickup = i === 0;
      const isDropoff = i === points.length - 1 && points.length > 1;
      // Hide the pickup pin once the trip is in progress.
      if (liveRoute?.target === "dropoff" && isPickup) return;
      const marker = new google.maps.Marker({
        map,
        position: { lat: place.lat, lng: place.lng },
        label: {
          text: label,
          color: "#ffffff",
          fontWeight: "700",
          fontSize: "12px",
        },
        // Red for pickup + dropoff endpoints, black for intermediate stops.
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: isPickup || isDropoff ? "#f10100" : "#111906",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
      markersRef.current.push(marker);
    });

    if (points.length === 1) {
      map.setCenter({ lat: points[0].place.lat, lng: points[0].place.lng });
      map.setZoom(14);
      return;
    }

    // When liveRoute is engaged, the live-route effect draws + fits its
    // own polyline. We're done after dropping the markers.
    if (liveRoute) return;

    // Two or more points → ask Google for a road-following route.
    // Token marker we use to ignore stale responses if the points change
    // again before the API call resolves.
    let cancelled = false;

    const drawStraightLineFallback = () => {
      if (cancelled) return;
      polylineRef.current = new google.maps.Polyline({
        map,
        path: points.map((p) => ({ lat: p.place.lat, lng: p.place.lng })),
        strokeColor: "#f10100",
        strokeWeight: 4,
        strokeOpacity: 0.85,
      });
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) =>
        bounds.extend({ lat: p.place.lat, lng: p.place.lng }),
      );
      map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
    };

    const service = directionsServiceRef.current;
    if (!service) {
      // Should not happen — DirectionsService is initialised with the map.
      drawStraightLineFallback();
      return;
    }

    const origin = points[0].place;
    const destination = points[points.length - 1].place;
    const waypoints = points.slice(1, -1).map((p) => ({
      location: new google.maps.LatLng(p.place.lat, p.place.lng),
      stopover: true,
    }));

    service
      .route({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        // Don't reorder — the rider's stop sequence is intentional (e.g.
        // pickup BBQ before dropping the friend at home).
        optimizeWaypoints: false,
      })
      .then((response) => {
        if (cancelled) return;
        const route = response.routes[0];
        if (!route) {
          drawStraightLineFallback();
          return;
        }
        // overview_path is the smoothed driving path — already a flat
        // LatLng[] across all legs.
        polylineRef.current = new google.maps.Polyline({
          map,
          path: route.overview_path,
          strokeColor: "#f10100",
          strokeWeight: 5,
          strokeOpacity: 0.9,
        });
        // Use the route's own bounds — tighter than fitting to stops alone.
        if (route.bounds) {
          map.fitBounds(route.bounds, {
            top: 56,
            right: 56,
            bottom: 56,
            left: 56,
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // Most common: ZERO_RESULTS for an over-water/un-routable pair, or
        // API not enabled. Surface a straight line so the user still sees
        // *something* connecting their points.
        // eslint-disable-next-line no-console
        console.warn("[MapView] Directions request failed:", err);
        drawStraightLineFallback();
      });

    return () => {
      cancelled = true;
    };
  }, [pickup, stops, dropoff, liveRoute]);

  // Live-route polyline: driver → pickup (or driver → dropoff). Refetches
  // the Directions polyline only when the driver has moved significantly
  // OR the target has flipped — moving the marker every 5s is fine, but
  // refetching the route every 5s would burn API budget and look jittery.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof window === "undefined" || !window.google) return;

    // Tear down when liveRoute is disengaged or there's no driver pos.
    if (!liveRoute || !driverPosition) {
      livePolylineRef.current?.setMap(null);
      livePolylineRef.current = null;
      liveRouteOriginRef.current = null;
      liveRouteTargetRef.current = null;
      return;
    }

    const target = liveRoute.target === "pickup" ? pickup : dropoff;
    if (!target) return;

    const driverLatLng = {
      lat: driverPosition.lat,
      lng: driverPosition.lng,
    };
    const targetChanged = liveRouteTargetRef.current !== liveRoute.target;
    const movedFar =
      !liveRouteOriginRef.current ||
      approxDistanceMeters(liveRouteOriginRef.current, driverLatLng) >
        LIVE_ROUTE_REFRESH_THRESHOLD_M;

    if (!targetChanged && !movedFar && livePolylineRef.current) {
      // Driver moved but only slightly — leave the existing polyline in
      // place. The car marker still updates via the driverPosition effect.
      return;
    }

    liveRouteOriginRef.current = driverLatLng;
    liveRouteTargetRef.current = liveRoute.target;

    const service = directionsServiceRef.current;
    if (!service) return;
    let cancelled = false;

    service
      .route({
        origin: driverLatLng,
        destination: { lat: target.lat, lng: target.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      })
      .then((response) => {
        if (cancelled) return;
        const route = response.routes[0];
        if (!route) return;
        // Replace previous live polyline (if any) with the new one.
        livePolylineRef.current?.setMap(null);
        livePolylineRef.current = new google.maps.Polyline({
          map,
          path: route.overview_path,
          strokeColor: "#f10100",
          strokeWeight: 5,
          strokeOpacity: 0.9,
        });
        // Fit the camera to driver+target the first time we draw the
        // route OR when the target changes. Subsequent refetches keep
        // the user's existing pan/zoom — they may have zoomed in
        // intentionally.
        if (targetChanged) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(driverLatLng);
          bounds.extend({ lat: target.lat, lng: target.lng });
          map.fitBounds(bounds, { top: 80, right: 60, bottom: 80, left: 60 });
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[MapView] Live Directions request failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [liveRoute, driverPosition, pickup, dropoff]);

  // Live driver position — rendered as the same car icon used for the
  // fleet view. Marker is reused across updates so the move feels smooth.
  // Heading is computed from successive positions (the browser's
  // `coords.heading` is null on most desktops and unreliable on
  // stationary mobile, so we derive it ourselves). When the driver
  // hasn't really moved (under 10m of jitter) we hold the previous
  // heading so a parked car keeps facing the way it last drove.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof window === "undefined" || !window.google) return;
    if (!driverPosition) {
      driverDotRef.current?.setMap(null);
      driverDotRef.current = null;
      prevDriverPosRef.current = null;
      driverIconBucketRef.current = -1;
      return;
    }
    const pos = { lat: driverPosition.lat, lng: driverPosition.lng };

    // Compute / refresh the heading.
    const prev = prevDriverPosRef.current;
    if (prev) {
      const moved = approxDistanceMeters(prev, pos);
      if (moved >= 10) {
        driverHeadingRef.current = computeBearing(prev, pos);
        prevDriverPosRef.current = pos;
      }
      // If we moved less than 10m, leave both prev pos and heading alone
      // — small GPS drift shouldn't repoint the car.
    } else {
      prevDriverPosRef.current = pos;
    }

    const heading = driverHeadingRef.current;
    const bucket =
      typeof heading === "number"
        ? (((Math.round(heading / 10) * 10) % 360) + 360) % 360
        : 0;

    if (!driverDotRef.current) {
      driverDotRef.current = new google.maps.Marker({
        map,
        position: pos,
        zIndex: 999,
        icon: buildCarIcon(heading),
        title: "Driver",
      });
      driverIconBucketRef.current = bucket;
    } else {
      driverDotRef.current.setPosition(pos);
      // Only re-set the icon when the rotation bucket actually changed —
      // setIcon swaps the data URL and forces an image re-decode.
      if (driverIconBucketRef.current !== bucket) {
        driverDotRef.current.setIcon(buildCarIcon(heading));
        driverIconBucketRef.current = bucket;
      }
    }
  }, [driverPosition]);

  // Fleet markers (Phase 2A.4 — nearby online drivers on booking screen).
  // We diff against the previous set: existing driverIds get setPosition,
  // new ones get a fresh Marker, and gone ones get removed from the map.
  // The marker is a coloured car SVG; rotation follows browser heading
  // when available.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof window === "undefined" || !window.google) return;

    const incoming = nearbyDrivers ?? [];
    const incomingIds = new Set(incoming.map((d) => d.driverId));

    // Drop markers for drivers no longer in the fleet snapshot.
    // Defensive against HMR: when the shape of `fleetMarkersRef`'s
    // entries changes (e.g. we wrapped raw Markers in `{marker, ...}`
    // for the rotation cache), the ref can survive the hot reload with
    // entries in the OLD shape. Optional-chain so we don't crash, and
    // fall through to delete stale entries either way.
    for (const [id, entry] of fleetMarkersRef.current) {
      if (!incomingIds.has(id)) {
        entry?.marker?.setMap(null);
        fleetMarkersRef.current.delete(id);
      }
    }

    const headingToBucket = (h: number | null | undefined) =>
      typeof h === "number"
        ? (((Math.round(h / 10) * 10) % 360) + 360) % 360
        : 0;

    // Add or move markers for currently-online drivers.
    incoming.forEach((d) => {
      const existing = fleetMarkersRef.current.get(d.driverId);
      const position = { lat: d.lat, lng: d.lng };
      const desiredBucket = headingToBucket(d.heading);

      if (existing && existing.marker) {
        existing.marker.setPosition(position);
        // Only re-set the icon when the rotation bucket actually
        // changed — setIcon forces a data-URL decode, which is wasted
        // work when the heading hasn't moved.
        if (existing.iconBucket !== desiredBucket) {
          existing.marker.setIcon(buildCarIcon(d.heading));
          existing.iconBucket = desiredBucket;
        }
      } else {
        const marker = new google.maps.Marker({
          map,
          position,
          icon: buildCarIcon(d.heading),
          title: "Driver online",
          // Below the active ride driver dot but above the route polyline.
          zIndex: 500,
          // Keep them out of the way of the rider clicking on the map.
          clickable: false,
        });
        fleetMarkersRef.current.set(d.driverId, {
          marker,
          iconBucket: desiredBucket,
        });
      }
    });
  }, [nearbyDrivers]);

  // Live rider position — same pattern but with a blue puck.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof window === "undefined" || !window.google) return;
    if (!riderPosition) {
      riderDotRef.current?.setMap(null);
      riderDotRef.current = null;
      return;
    }
    const pos = { lat: riderPosition.lat, lng: riderPosition.lng };
    if (!riderDotRef.current) {
      riderDotRef.current = new google.maps.Marker({
        map,
        position: pos,
        zIndex: 998,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#1d4ed8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        title: "You",
      });
    } else {
      riderDotRef.current.setPosition(pos);
    }
  }, [riderPosition]);

  return (
    // `min-h-[16rem]` is a belt-and-suspenders height floor in case a flex
    // ancestor on mobile collapses our height-class — Google Maps refuses
    // to render in a 0-height div, which would just leave a blank rectangle.
    <div
      className={`relative min-h-[16rem] overflow-hidden bg-surface-soft ${className}`}
    >
      {/* Inner div fills the wrapper. Switched off `absolute inset-0` to
          plain `h-full w-full` because mobile Safari occasionally fails to
          size absolute-positioned children inside overflow-hidden ancestors,
          leaving the Google Maps container at 0×0. */}
      <div ref={containerRef} className="h-full w-full" />
      {loadError && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-surface-soft px-4">
          <div className="max-w-xs rounded-2xl bg-white px-4 py-3 text-center text-xs font-medium text-muted shadow-md">
            <p className="font-bold text-rajlo-red">Map failed to load</p>
            <p className="mt-1 break-words">{loadError}</p>
            <p className="mt-2 text-[10px]">
              Check Google Cloud Console → API key → Application restrictions
              include the host you&apos;re viewing from.
            </p>
          </div>
        </div>
      )}
      {!loadError && !pickup && stops.length === 0 && !dropoff && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-muted shadow-md backdrop-blur">
            Pick a destination to see your route
          </div>
        </div>
      )}
      {(driverPosition ||
        riderPosition ||
        (nearbyDrivers && nearbyDrivers.length > 0)) && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-[11px] font-bold shadow-md backdrop-blur">
          {driverPosition && (
            <div className="flex items-center gap-2">
              <span className="grid h-3.5 w-3.5 place-items-center">
                <span className="h-3 w-2 rounded-sm bg-rajlo-red" />
              </span>
              Driver
            </div>
          )}
          {riderPosition && (
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-700 ring-1 ring-blue-700/50" />
              You
            </div>
          )}
          {!driverPosition &&
            nearbyDrivers &&
            nearbyDrivers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-rajlo-red" />
                {nearbyDrivers.length} driver
                {nearbyDrivers.length === 1 ? "" : "s"} online nearby
              </div>
            )}
        </div>
      )}
    </div>
  );
}

/**
 * Build a Google Maps URL-based icon for a fleet car marker, rotated to
 * face the given heading. We cache by 10° buckets so we don't burn CPU
 * re-encoding the SVG every heartbeat — at most 36 distinct icon objects
 * exist across the whole app session no matter how many drivers there
 * are. Heading null = car points up (no orientation known yet).
 */
const carIconCache = new Map<number, google.maps.Icon>();
function buildCarIcon(heading: number | null | undefined): google.maps.Icon {
  // Bucket to 10° increments and normalise into [0, 360).
  const bucket =
    typeof heading === "number"
      ? ((Math.round(heading / 10) * 10) % 360 + 360) % 360
      : 0;
  const cached = carIconCache.get(bucket);
  if (cached) return cached;
  const svg = carIconSvg(bucket);
  const icon: google.maps.Icon = {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    // 28×42 keeps the icon legible without dominating the map. Anchor at
    // (14, 21) puts the car's centre on the driver's actual coordinates.
    scaledSize: new google.maps.Size(28, 42),
    anchor: new google.maps.Point(14, 21),
  };
  carIconCache.set(bucket, icon);
  return icon;
}
