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
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  // Live-position markers are tracked separately so they don't get wiped
  // when the route refreshes.
  const driverDotRef = useRef<google.maps.Marker | null>(null);
  const riderDotRef = useRef<google.maps.Marker | null>(null);
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

  // Re-render markers + route + bounds whenever the waypoints change.
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
    points.forEach(({ place, label }, i) => {
      const isPickup = i === 0;
      const isDropoff = i === points.length - 1 && points.length > 1;
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
  }, [pickup, stops, dropoff]);

  // Live driver position — separate effect so route changes don't wipe it.
  // Marker is reused across updates so the move feels smooth.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof window === "undefined" || !window.google) return;
    if (!driverPosition) {
      driverDotRef.current?.setMap(null);
      driverDotRef.current = null;
      return;
    }
    const pos = { lat: driverPosition.lat, lng: driverPosition.lng };
    if (!driverDotRef.current) {
      driverDotRef.current = new google.maps.Marker({
        map,
        position: pos,
        zIndex: 999,
        // Red car-coloured halo — a filled red dot with a black outline ring.
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#f10100",
          fillOpacity: 1,
          strokeColor: "#111906",
          strokeWeight: 3,
        },
        title: "Driver",
      });
    } else {
      driverDotRef.current.setPosition(pos);
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
              <span className="h-2.5 w-2.5 rounded-full border-2 border-rajlo-black bg-rajlo-red" />
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
