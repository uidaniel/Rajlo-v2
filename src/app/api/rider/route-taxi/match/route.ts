import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { haversineKm } from "@/lib/jamaica";

/**
 * POST /api/rider/route-taxi/match
 *
 * Given a rider's pickup + dropoff (with names + parishes from Google
 * Places), find which TA-licensed corridors can serve the trip.
 *
 * Strategy: fuzzy token-overlap on the route's origin/destination names
 * vs the rider's pickup/dropoff names + addresses, in BOTH directions
 * (a route Half-Way-Tree → Papine also serves a rider going Papine →
 * Half-Way-Tree as the reverse leg).
 *
 * We don't have lat/lng on the routes (TA's PDF doesn't ship them),
 * so name matching is the spine for now. When parishes match too, we
 * boost the score; when they conflict, we filter the route out (a
 * "Hopewell" in Hanover is not the same as a "Hopewell" in St. James).
 *
 * GEOGRAPHIC SANITY GATE: name-token overlap alone false-matches
 * unrelated corridors that share a generic word ("Park", "Bay",
 * "Town") — e.g. a 240 km Kingston→Negril trip matching a 15 km
 * "Moore Park → Montego Bay" corridor on "park" + "bay". So when the
 * client sends pickup/dropoff coordinates we reject any corridor the
 * trip physically can't fit on (trip distance ≫ corridor length).
 *
 * Body:
 *   { pickup: { name, address?, parish?, lat?, lng? },
 *     dropoff: { name, address?, parish?, lat?, lng? } }
 *
 * Response:
 *   { matches: Array<{ route, direction, fareJmd, walkKm?, confidence }> }
 *
 * If `matches` is empty the rider gets a "Private Ride only — no route
 * taxi covers this trip yet" message. That's the honest answer; we
 * don't fake a corridor that doesn't exist.
 */

type RiderPlace = {
  name?: unknown;
  address?: unknown;
  parish?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type MatchBody = { pickup?: RiderPlace; dropoff?: RiderPlace };

type RouteRow = {
  id: string;
  origin_name: string;
  destination_name: string;
  origin_parish: string | null;
  destination_parish: string | null;
  distance_km: number;
  ta_fare_jmd: number;
  slug: string;
};

const STOPWORDS = new Set([
  "jamaica",
  "the",
  "and",
  "a",
  "an",
  "of",
  "to",
  "in",
  "at",
  "on",
  "by",
  "road",
  "rd",
  "avenue",
  "ave",
  "street",
  "st",
  "drive",
  "dr",
  "lane",
  "ln",
  "highway",
  "hwy",
  "parish",
  "boulevard",
  "blvd",
  "way",
  "place",
  "pl",
  "court",
  "ct",
  "square",
  "sq",
]);

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as MatchBody;
  const pickupName = asString(body.pickup?.name);
  const dropoffName = asString(body.dropoff?.name);
  if (!pickupName || !dropoffName) {
    return NextResponse.json(
      { error: "pickup and dropoff names are required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const pickupTokens = tokenize(
    `${pickupName} ${asString(body.pickup?.address) ?? ""}`,
  );
  const dropoffTokens = tokenize(
    `${dropoffName} ${asString(body.dropoff?.address) ?? ""}`,
  );
  const pickupParish = normaliseParish(asString(body.pickup?.parish));
  const dropoffParish = normaliseParish(asString(body.dropoff?.parish));

  if (pickupTokens.size === 0 || dropoffTokens.size === 0) {
    return NextResponse.json({ matches: [] });
  }

  // Straight-line trip distance for the geographic sanity gate. Null
  // when the client didn't send coordinates — the gate is then skipped
  // and we fall back to name-only matching.
  const pickupCoord = asCoord(body.pickup);
  const dropoffCoord = asCoord(body.dropoff);
  const tripKm =
    pickupCoord && dropoffCoord
      ? haversineKm(pickupCoord, dropoffCoord)
      : null;

  // We could narrow by parish at the SQL layer but our parish column on
  // routes uses the TA's combined string ("Kingston and St. Andrew")
  // while Google returns just "Kingston" — easier to do parish
  // matching in JS where we can do partial overlap.
  const { data: routes, error } = await supabase
    .from("routes")
    .select(
      "id, origin_name, destination_name, origin_parish, destination_parish, distance_km, ta_fare_jmd, slug",
    )
    .eq("active", true)
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Candidate = {
    route: RouteRow;
    direction: "forward" | "reverse";
    score: number;
    confidence: "high" | "medium" | "low";
  };

  const candidates: Candidate[] = [];

  let gatedOut = 0;
  let parishGated = 0;
  for (const r of (routes ?? []) as RouteRow[]) {
    // Geographic sanity gate. A route taxi rider boards a segment of
    // the corridor, so the trip can't be meaningfully longer than the
    // corridor itself. 1.3× absorbs straight-line-vs-road slack and
    // +2 km helps very short corridors. Skipped when no coords.
    const routeKm = Number(r.distance_km);
    if (tripKm !== null && tripKm > routeKm * 1.3 + 2) {
      gatedOut++;
      continue;
    }

    const originTokens = tokenize(r.origin_name);
    const destTokens = tokenize(r.destination_name);

    // Forward: route origin ↔ rider pickup, route dest ↔ rider dropoff
    const fOriginScore = overlapScore(originTokens, pickupTokens);
    const fDestScore = overlapScore(destTokens, dropoffTokens);
    if (fOriginScore > 0 && fDestScore > 0) {
      // Parish hard-filter: a corridor whose parish doesn't line up
      // with the rider's trip is rejected outright — name-token
      // overlap alone ("Hopewell" exists in two parishes) is not
      // enough. Skipped per-end when the rider's parish is unknown.
      if (
        parishCompatible(r.origin_parish, pickupParish) &&
        parishCompatible(r.destination_parish, dropoffParish)
      ) {
        const total = fOriginScore + fDestScore + 0.5;
        candidates.push({
          route: r,
          direction: "forward",
          score: total,
          confidence: bucket(total),
        });
      } else {
        parishGated++;
      }
    }

    // Reverse: route origin ↔ rider dropoff, route dest ↔ rider pickup
    const rOriginScore = overlapScore(originTokens, dropoffTokens);
    const rDestScore = overlapScore(destTokens, pickupTokens);
    if (rOriginScore > 0 && rDestScore > 0) {
      if (
        parishCompatible(r.origin_parish, dropoffParish) &&
        parishCompatible(r.destination_parish, pickupParish)
      ) {
        const total = rOriginScore + rDestScore + 0.5;
        candidates.push({
          route: r,
          direction: "reverse",
          score: total,
          confidence: bucket(total),
        });
      } else {
        parishGated++;
      }
    }
  }

  // De-dupe — a route appearing in both directions keeps the higher
  // scoring one. Then sort by score desc, take top 3.
  const bestPerRoute = new Map<string, Candidate>();
  for (const c of candidates) {
    const cur = bestPerRoute.get(c.route.id);
    if (!cur || c.score > cur.score) bestPerRoute.set(c.route.id, c);
  }
  const top = Array.from(bestPerRoute.values())
    .sort((a, b) => b.score - a.score || a.route.distance_km - b.route.distance_km)
    .slice(0, 3);

  // Diagnostic log — counts only. We deliberately do NOT log the
  // rider's pickup/dropoff strings here: those are the rider's own
  // trip patterns and would accumulate in retained server logs as
  // a rolling map of where each user travels. Counts are enough to
  // debug "matcher returned nothing for an obvious corridor" reports.
  console.log(
    `[route-match] pickupTokens=${pickupTokens.size} dropoffTokens=${dropoffTokens.size} ` +
      `routesScanned=${routes?.length ?? 0} distanceGated=${gatedOut} ` +
      `parishGated=${parishGated} ` +
      `tripKm=${tripKm !== null ? tripKm.toFixed(1) : "n/a"} ` +
      `candidates=${candidates.length} returned=${top.length}` +
      (top.length > 0 ? ` topScore=${top[0].score.toFixed(2)}` : ""),
  );

  return NextResponse.json({
    matches: top.map((c) => ({
      route: {
        id: c.route.id,
        origin: c.route.origin_name,
        destination: c.route.destination_name,
        parish: c.route.origin_parish,
        distanceKm: Number(c.route.distance_km),
        taFareJmd: c.route.ta_fare_jmd,
        slug: c.route.slug,
      },
      direction: c.direction,
      fareJmd: c.route.ta_fare_jmd,
      confidence: c.confidence,
    })),
  });
}

/* ─── Helpers ─── */

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Pull a usable {lat,lng} from a rider place, or null. Rejects the
 *  stuck-on-zero (0,0) fix that means "no GPS yet". */
function asCoord(
  p: RiderPlace | undefined,
): { lat: number; lng: number } | null {
  if (!p) return null;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * Lowercase, normalise punctuation (hyphens, dashes, slashes, periods,
 * apostrophes, parens — all become whitespace), split on whitespace,
 * drop stopwords + short words.
 *
 * Aggressive normalisation matters here because Google sometimes
 * returns "Half-Way Tree" with hyphens or "St. Andrew's" with a smart
 * quote, while the TA seed has "Half Way Tree" / "St. Andrew" — we
 * need both to tokenize the same way.
 */
function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  const lowered = s
    .toLowerCase()
    .replace(/[.,/'’()\-–—_"`]/g, " ");
  for (const word of lowered.split(/\s+/)) {
    const w = word.trim();
    if (w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    out.add(w);
  }
  return out;
}

/**
 * Score how well two token sets overlap. We weight by the SHORTER
 * set (the route name) so a rider whose dropoff address is long
 * doesn't mechanically beat shorter matches.
 */
function overlapScore(routeTokens: Set<string>, riderTokens: Set<string>): number {
  if (routeTokens.size === 0 || riderTokens.size === 0) return 0;
  let hits = 0;
  for (const t of routeTokens) if (riderTokens.has(t)) hits++;
  return hits / routeTokens.size;
}

function bucket(score: number): "high" | "medium" | "low" {
  if (score >= 1.6) return "high";
  if (score >= 1.0) return "medium";
  return "low";
}

/** Words that carry no parish identity — dropped before comparison so
 *  "Saint James" / "St. James" / "St James Parish" all reduce to the
 *  single distinctive token {james}. */
const PARISH_STOP = new Set(["st", "saint", "and", "the", "parish"]);

/** Reduce a parish string to its distinctive tokens. "Kingston and
 *  St. Andrew" → {kingston, andrew}; "Saint James" → {james}. */
function parishTokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.toLowerCase().replace(/[.,]/g, " ").split(/\s+/)) {
    const t = w.trim();
    if (t.length < 3 || PARISH_STOP.has(t)) continue;
    out.add(t);
  }
  return out;
}

/**
 * Parishes are "compatible" when either side is missing (the rider may
 * not have a parish from Google — we don't reject on absent data), or
 * when their distinctive tokens overlap.
 *
 * Token comparison (not substring) so the TA's combined "Kingston and
 * St. Andrew" matches a rider parish of "Kingston" OR "St. Andrew",
 * and "Saint James" matches "St. James" — while "St. James" vs
 * "St. Catherine" correctly does NOT match (no shared token).
 */
function parishCompatible(
  routeParish: string | null,
  riderParish: string | null,
): boolean {
  if (!routeParish || !riderParish) return true;
  const r = parishTokens(routeParish);
  const p = parishTokens(riderParish);
  if (r.size === 0 || p.size === 0) return true;
  for (const t of p) if (r.has(t)) return true;
  return false;
}

function normaliseParish(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/\s+parish\s*$/i, "").trim();
}
