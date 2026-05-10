/**
 * Jamaica-specific geo + fare helpers.
 *
 * Used by the rider booking flow to:
 *   - Bias Google autocomplete to JM-only results
 *   - Center the map and fit bounds to Jamaica
 *   - Detect the parish from a Google address result
 *   - Estimate a fare client-side (cheap haversine, good enough for preview;
 *     the canonical fare is computed server-side at booking time)
 */

/** Bounding box covering all of Jamaica + nearshore waters. */
export const JAMAICA_BOUNDS = {
  north: 18.6,
  south: 17.6,
  east: -76.0,
  west: -78.5,
};

/** Geographic centre — used as the default map view. */
export const JAMAICA_CENTER = { lat: 18.05, lng: -77.2 };

/**
 * Approximate centre of each Jamaican parish — keyed by the names the
 * TA route table uses so a parish detected from GPS can match a
 * route's `origin_parish` directly. Rough centres (~parish capital);
 * good enough for "which parish is this driver in" lookups without
 * a Google reverse-geocode round-trip.
 */
export const PARISH_CENTERS: Record<string, { lat: number; lng: number }> = {
  "Kingston and St. Andrew": { lat: 17.99, lng: -76.79 },
  Kingston: { lat: 17.97, lng: -76.79 },
  "St. Andrew": { lat: 18.02, lng: -76.81 },
  "St. Catherine": { lat: 17.99, lng: -76.95 },
  Clarendon: { lat: 17.96, lng: -77.24 },
  Manchester: { lat: 18.04, lng: -77.5 },
  "St. Elizabeth": { lat: 18.03, lng: -77.85 },
  Westmoreland: { lat: 18.22, lng: -78.13 },
  Hanover: { lat: 18.45, lng: -78.18 },
  "St. James": { lat: 18.47, lng: -77.92 },
  Trelawny: { lat: 18.49, lng: -77.66 },
  "St. Ann": { lat: 18.43, lng: -77.2 },
  "St. Mary": { lat: 18.36, lng: -76.89 },
  Portland: { lat: 18.18, lng: -76.45 },
  "St. Thomas": { lat: 17.88, lng: -76.41 },
};

/** All 14 parishes (admin-area-level-1 values returned by Google). */
export const PARISHES = [
  "Kingston",
  "St. Andrew",
  "St. Catherine",
  "Clarendon",
  "Manchester",
  "St. Elizabeth",
  "Westmoreland",
  "Hanover",
  "St. James",
  "Trelawny",
  "St. Ann",
  "St. Mary",
  "Portland",
  "St. Thomas",
] as const;

export type Parish = (typeof PARISHES)[number];

/** Pull the parish name out of a Google `address_components` array. */
export function detectParish(
  components: google.maps.GeocoderAddressComponent[] | undefined,
): string | null {
  if (!components) return null;
  for (const c of components) {
    if (c.types.includes("administrative_area_level_1")) {
      // Google sometimes returns "Saint Andrew Parish" — normalise.
      return c.long_name
        .replace(/^Saint\s+/i, "St. ")
        .replace(/\s+Parish$/i, "")
        .trim();
    }
  }
  return null;
}

/**
 * Canonical Place shape used across the booking flow.
 * Stable across Google Places API quirks; everything we render UI from.
 */
export type Place = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  parish: string | null;
};

/* ────── Fare model ──────
 * Phase 2A placeholder — keep simple, validate later from booking data.
 * All numbers in JMD.
 */
export const FARE_CONFIG = {
  baseFareJMD: 250,
  perKmJMD: 90,
  perStopJMD: 150,
  perExtraSeatJMD: 60,
  minFareJMD: 400,
  /** Rough average speed for ETA estimates (urban JM corridors). */
  avgKmh: 32,
} as const;

/**
 * True when the coord is plausibly inside Jamaica's bounding box.
 * Used to reject obviously-bogus GPS coords (stuck-on-zero fixes,
 * test addresses from elsewhere) before they reach the matcher.
 */
export function isWithinJamaica(coord: {
  lat: number;
  lng: number;
}): boolean {
  return (
    Number.isFinite(coord.lat) &&
    Number.isFinite(coord.lng) &&
    coord.lat >= JAMAICA_BOUNDS.south &&
    coord.lat <= JAMAICA_BOUNDS.north &&
    coord.lng >= JAMAICA_BOUNDS.west &&
    coord.lng <= JAMAICA_BOUNDS.east
  );
}

/**
 * Find the parish whose centre is closest to a GPS coordinate. Used
 * when we want to scope a list (e.g. driver Route Taxi suggestions)
 * to "wherever I am" without burning a Google reverse-geocode call.
 * Returns the parish name (matches `routes.origin_parish`) or null
 * when the coord is implausibly far from every parish (e.g. outside JM).
 */
export function nearestParish(coord: {
  lat: number;
  lng: number;
}): string | null {
  if (!Number.isFinite(coord.lat) || !Number.isFinite(coord.lng)) return null;
  let best: { name: string; km: number } | null = null;
  for (const [name, centre] of Object.entries(PARISH_CENTERS)) {
    const km = haversineKm(coord, centre);
    if (!best || km < best.km) best = { name, km };
  }
  // 50 km cap — anything farther is clearly off-island and we'd
  // rather show "no parish" than guess.
  if (!best || best.km > 50) return null;
  return best.name;
}

/** Great-circle distance between two coords in km (haversine). */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371; // earth radius in km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Total straight-line distance through an ordered list of waypoints. */
export function routeDistanceKm(points: { lat: number; lng: number }[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

export type FareEstimate = {
  totalKm: number;
  etaMinutes: number;
  fareJMD: number;
  /** Per-line breakdown for the UI receipt. */
  breakdown: {
    label: string;
    amountJMD: number;
  }[];
};

/**
 * Client-side fare preview. Real fare gets computed server-side at booking
 * time using Google Routes (driving distance) — this is just an estimate
 * to show the rider before they tap "Request ride".
 */
export function estimateFare(
  points: { lat: number; lng: number }[],
  seats: number,
): FareEstimate {
  if (points.length < 2) {
    return {
      totalKm: 0,
      etaMinutes: 0,
      fareJMD: 0,
      breakdown: [],
    };
  }
  // Driving distance is roughly 1.25× great-circle for JM road network.
  const totalKm = routeDistanceKm(points) * 1.25;
  const etaMinutes = Math.max(
    5,
    Math.round((totalKm / FARE_CONFIG.avgKmh) * 60),
  );

  const intermediateStops = Math.max(0, points.length - 2);
  const extraSeats = Math.max(0, seats - 1);

  const distanceFare = totalKm * FARE_CONFIG.perKmJMD;
  const stopsFare = intermediateStops * FARE_CONFIG.perStopJMD;
  const seatsFare = extraSeats * FARE_CONFIG.perExtraSeatJMD;

  const breakdown: FareEstimate["breakdown"] = [
    { label: "Base fare", amountJMD: FARE_CONFIG.baseFareJMD },
    { label: `Distance · ${totalKm.toFixed(1)} km`, amountJMD: Math.round(distanceFare) },
  ];
  if (intermediateStops > 0) {
    breakdown.push({
      label: `${intermediateStops} stop${intermediateStops === 1 ? "" : "s"}`,
      amountJMD: stopsFare,
    });
  }
  if (extraSeats > 0) {
    breakdown.push({
      label: `${extraSeats} extra seat${extraSeats === 1 ? "" : "s"}`,
      amountJMD: seatsFare,
    });
  }

  const subtotal =
    FARE_CONFIG.baseFareJMD + distanceFare + stopsFare + seatsFare;
  const fareJMD = Math.max(
    FARE_CONFIG.minFareJMD,
    // Round to the nearest 50 JMD for clean pricing.
    Math.round(subtotal / 50) * 50,
  );

  return { totalKm, etaMinutes, fareJMD, breakdown };
}

export function formatJMD(amount: number): string {
  return `JMD ${amount.toLocaleString("en-JM")}`;
}
