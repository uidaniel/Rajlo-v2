import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

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

  for (const r of (routes ?? []) as RouteRow[]) {
    const originTokens = tokenize(r.origin_name);
    const destTokens = tokenize(r.destination_name);

    // Forward: route origin ↔ rider pickup, route dest ↔ rider dropoff
    const fOriginScore = overlapScore(originTokens, pickupTokens);
    const fDestScore = overlapScore(destTokens, dropoffTokens);
    if (fOriginScore > 0 && fDestScore > 0) {
      const parishBoost =
        parishCompatible(r.origin_parish, pickupParish) &&
        parishCompatible(r.destination_parish, dropoffParish)
          ? 0.5
          : 0;
      const total = fOriginScore + fDestScore + parishBoost;
      candidates.push({
        route: r,
        direction: "forward",
        score: total,
        confidence: bucket(total),
      });
    }

    // Reverse: route origin ↔ rider dropoff, route dest ↔ rider pickup
    const rOriginScore = overlapScore(originTokens, dropoffTokens);
    const rDestScore = overlapScore(destTokens, pickupTokens);
    if (rOriginScore > 0 && rDestScore > 0) {
      const parishBoost =
        parishCompatible(r.origin_parish, dropoffParish) &&
        parishCompatible(r.destination_parish, pickupParish)
          ? 0.5
          : 0;
      const total = rOriginScore + rDestScore + parishBoost;
      candidates.push({
        route: r,
        direction: "reverse",
        score: total,
        confidence: bucket(total),
      });
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

  // Diagnostic log — visible in the dev server terminal. Helps debug
  // "matcher returned nothing for an obvious corridor" reports by
  // showing exactly what Google sent us vs. how we tokenised it.
  console.log(
    `[route-match] pickup="${pickupName}" dropoff="${dropoffName}" ` +
      `pickupTokens=[${[...pickupTokens].join(",")}] ` +
      `dropoffTokens=[${[...dropoffTokens].join(",")}] ` +
      `routesScanned=${routes?.length ?? 0} candidates=${candidates.length} returned=${top.length}` +
      (top.length > 0
        ? ` topScore=${top[0].score.toFixed(2)} topRoute="${top[0].route.origin_name} → ${top[0].route.destination_name}"`
        : ""),
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

/**
 * Parishes are "compatible" when either side is missing (rider may
 * not have parish from Google), or the route's parish string contains
 * the rider's parish (TA uses "Kingston and St. Andrew", Google
 * returns just "Kingston" or "St. Andrew").
 */
function parishCompatible(
  routeParish: string | null,
  riderParish: string | null,
): boolean {
  if (!routeParish || !riderParish) return true;
  const r = routeParish.toLowerCase();
  const p = riderParish.toLowerCase();
  return r.includes(p) || p.includes(r);
}

function normaliseParish(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/\s+parish\s*$/i, "").trim();
}
