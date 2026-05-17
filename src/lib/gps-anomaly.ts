/**
 * GPS anomaly detection — the server-side half of fake-GPS detection.
 *
 * A reliable "is this device running a fake-GPS app" check needs the
 * native OS mock-location flag (a Capacitor-layer signal). But one
 * strong fraud signal IS computable purely from the coordinate stream
 * the server already receives: **impossible travel**. If two
 * consecutive position pings imply a speed no Jamaican road vehicle
 * could sustain, the location is being falsified.
 *
 * These are pure functions — no DB, no IO — so they can run in any
 * position-handling path.
 */

export type GpsPoint = {
  lat: number;
  lng: number;
  /** Epoch milliseconds the fix was taken. */
  at: number;
};

export type GpsAnomaly = {
  type: "impossible_speed" | "gps_jump";
  /** Implied speed between the two points, km/h. */
  speedKmh: number;
  /** Straight-line distance between the two points, km. */
  distanceKm: number;
  /** Seconds elapsed between the two fixes. */
  elapsedSeconds: number;
};

/** No road vehicle in Jamaica sustains this — above it, the location
 *  stream is almost certainly falsified or the device is being
 *  teleported by a mock-GPS tool. */
const IMPOSSIBLE_SPEED_KMH = 200;

/** A single fix that jumps this far in under 10 seconds is treated as
 *  a teleport even if the averaged speed math is noisy. */
const GPS_JUMP_KM = 3;
const GPS_JUMP_WINDOW_SECONDS = 10;

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(a: GpsPoint, b: GpsPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Compare two consecutive GPS fixes for the same user/trip. Returns an
 * anomaly when the movement between them is physically implausible, or
 * null when it looks normal.
 */
export function detectGpsAnomaly(
  prev: GpsPoint,
  next: GpsPoint,
): GpsAnomaly | null {
  const elapsedSeconds = (next.at - prev.at) / 1000;
  // Out-of-order or duplicate timestamps tell us nothing.
  if (elapsedSeconds <= 0) return null;

  const distanceKm = haversineKm(prev, next);
  const speedKmh = distanceKm / (elapsedSeconds / 3600);

  if (
    distanceKm >= GPS_JUMP_KM &&
    elapsedSeconds <= GPS_JUMP_WINDOW_SECONDS
  ) {
    return { type: "gps_jump", speedKmh, distanceKm, elapsedSeconds };
  }
  if (speedKmh > IMPOSSIBLE_SPEED_KMH) {
    return { type: "impossible_speed", speedKmh, distanceKm, elapsedSeconds };
  }
  return null;
}
