import "server-only";

/**
 * Server-side Google Directions API helper.
 *
 * One call per trip at start-of-trip captures the route polyline +
 * baseline distance / duration; we store all three on the rides row
 * so the off-route detector has a stable reference to compare driver
 * positions against without re-hitting Directions on every ping.
 *
 * Why server-side instead of browser-side?
 *   - The API key restriction can be tighter (no HTTP referrer needed)
 *     so it's harder to scrape.
 *   - The fetched polyline lives in the DB and is shared between rider,
 *     driver, and admin clients — fetch-once is much cheaper than
 *     three clients each requesting their own copy.
 *
 * We reuse `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for now (single Google
 * Cloud project, Directions API enabled). When we add a dedicated
 * server-only key, prefer `GOOGLE_MAPS_SERVER_KEY` and fall back to
 * the public one for local dev.
 */

const DIRECTIONS_BASE = "https://maps.googleapis.com/maps/api/directions/json";

export type PlannedRoute = {
  /** Encoded polyline (algorithm 1, precision 5). */
  polyline: string;
  /** Total route distance in metres. */
  distanceM: number;
  /** Total route duration in seconds (no live traffic). */
  durationS: number;
};

/**
 * Fetch the recommended driving route between two points. Returns
 * `null` if Google returns NO_ROUTE / quota / network error — callers
 * should treat absence of a planned route as "off-route detection
 * disabled for this trip", not as a fatal error.
 */
export async function fetchPlannedRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<PlannedRoute | null> {
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const url = new URL(DIRECTIONS_BASE);
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("mode", "driving");
  // Region biasing — keeps the route picker on Jamaican roads when the
  // place names are ambiguous globally (e.g., "Kingston" exists in
  // many countries).
  url.searchParams.set("region", "jm");
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString(), {
      // Direction lookups are deterministic for a given origin/dest, but
      // we don't want any HTTP cache hiding a transient error code.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DirectionsResponse;
    if (data.status !== "OK") return null;
    const route = data.routes?.[0];
    if (!route) return null;
    const leg = route.legs?.[0];
    if (!leg) return null;
    return {
      polyline: route.overview_polyline.points,
      distanceM: leg.distance.value,
      durationS: leg.duration.value,
    };
  } catch {
    return null;
  }
}

type DirectionsResponse = {
  status: string;
  routes?: Array<{
    overview_polyline: { points: string };
    legs?: Array<{
      distance: { value: number };
      duration: { value: number };
    }>;
  }>;
};
