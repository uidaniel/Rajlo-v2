import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import {
  ROUTE_TAXI_BASE_RATE_JMD,
  ROUTE_TAXI_RATE_PER_KM_JMD,
  calculateRouteFareDetailed,
  calculateConcessionFare,
} from "@/lib/fare-engine";

/**
 * POST /api/rider/route-taxi/quote
 *
 * Returns a fare quote for a Route Taxi (Mode B) trip.
 *
 * Body:
 *   { routeId: string }     — quote the seeded TA fare for this corridor
 *   { distanceKm: number }  — quote an ad-hoc distance via the formula
 *
 * The seeded TA fare is preferred when available (it's the legally
 * regulated number for that exact OD pair). Fall back to the formula
 * when the rider supplies a custom distance for a leg.
 */
type QuoteBody = { routeId?: string; distanceKm?: number };

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: QuoteBody;
  try {
    body = (await request.json()) as QuoteBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.routeId && typeof body.distanceKm !== "number") {
    return NextResponse.json(
      { error: "Provide either routeId or distanceKm" },
      { status: 400 },
    );
  }

  // Direct ad-hoc quote — no DB lookup.
  if (typeof body.distanceKm === "number" && !body.routeId) {
    if (!Number.isFinite(body.distanceKm) || body.distanceKm < 0) {
      return NextResponse.json(
        { error: "distanceKm must be a non-negative number" },
        { status: 400 },
      );
    }
    const detail = calculateRouteFareDetailed(body.distanceKm);
    return NextResponse.json({
      source: "formula",
      route: null,
      distanceKm: detail.distanceKm,
      fareJmd: detail.roundedFareJmd,
      concessionFareJmd: calculateConcessionFare(body.distanceKm),
      breakdown: {
        baseRateJmd: ROUTE_TAXI_BASE_RATE_JMD,
        perKmRateJmd: ROUTE_TAXI_RATE_PER_KM_JMD,
        rawJmd: detail.rawFareJmd,
      },
    });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const { data: route, error } = await supabase
    .from("routes")
    .select(
      "id, origin_name, destination_name, origin_parish, destination_parish, distance_km, ta_fare_jmd, slug",
    )
    .eq("id", body.routeId!)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!route) {
    return NextResponse.json({ error: "route not found" }, { status: 404 });
  }

  const distanceKm = Number(route.distance_km);
  const detail = calculateRouteFareDetailed(distanceKm);
  // Prefer the published TA fare (regulated), fall back to formula.
  const taFare = (route as { ta_fare_jmd: number }).ta_fare_jmd;
  const fareJmd = taFare > 0 ? taFare : detail.roundedFareJmd;

  return NextResponse.json({
    source: "ta_table",
    route: {
      id: route.id,
      origin: route.origin_name,
      destination: route.destination_name,
      parish: route.origin_parish,
      slug: route.slug,
    },
    distanceKm,
    fareJmd,
    concessionFareJmd: Math.round(fareJmd / 2),
    breakdown: {
      baseRateJmd: ROUTE_TAXI_BASE_RATE_JMD,
      perKmRateJmd: ROUTE_TAXI_RATE_PER_KM_JMD,
      rawJmd: detail.rawFareJmd,
      formulaRoundedJmd: detail.roundedFareJmd,
      taPublishedJmd: taFare,
    },
  });
}
