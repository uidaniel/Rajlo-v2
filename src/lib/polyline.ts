/**
 * Google encoded polyline algorithm (precision 5) — decode + closest
 * distance utilities used by the off-route detector.
 *
 * The encoded polyline format is what Directions API returns in
 * `routes[].overview_polyline.points`. Each lat/lng is delta-encoded
 * as variable-length ASCII; see Google's spec at
 *   https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * No external dependency — the algorithm is small and dependency-free
 * implementations are well-tested.
 */

export type LatLng = { lat: number; lng: number };

/** Decode an encoded polyline string into an array of lat/lng pairs. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Haversine distance in metres between two lat/lng pairs. */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Minimum perpendicular distance (in metres) from `point` to any
 * segment of `polyline`. Used to decide whether the driver is "on the
 * planned route" — values >300m for >2 minutes are treated as off-
 * route by the detector.
 *
 * Implementation: projects each segment into a local equirectangular
 * tangent plane around the segment's midpoint and computes the
 * scalar-projection of the point onto the segment. Cheap, no
 * dependencies, accurate enough at city scales (<1% error for
 * segments <50km — way more than we'll see between two GPS pings).
 *
 * Returns Infinity if the polyline has fewer than 2 points.
 */
export function distanceToPolylineM(point: LatLng, polyline: LatLng[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineM(point, polyline[0]);

  let best = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distanceToSegmentM(point, polyline[i], polyline[i + 1]);
    if (d < best) best = d;
    // Early-out — once we know we're within 50m, no point exhausting
    // the whole polyline. The detector threshold is 300m so this is
    // a safe heuristic short-circuit.
    if (best < 50) return best;
  }
  return best;
}

function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  // Project to local metres tangent plane centered on segment midpoint.
  const midLat = (a.lat + b.lat) / 2;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((midLat * Math.PI) / 180);

  const ax = (a.lng - p.lng) * mPerDegLng;
  const ay = (a.lat - p.lat) * mPerDegLat;
  const bx = (b.lng - p.lng) * mPerDegLng;
  const by = (b.lat - p.lat) * mPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(ax, ay);

  // Scalar projection parameter t along segment, clamped to [0,1].
  let t = -(ax * dx + ay * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return Math.hypot(cx, cy);
}
