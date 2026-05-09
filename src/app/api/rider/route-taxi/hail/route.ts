import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { hasSufficientBalance } from "@/lib/wallet";
import { calculateRouteFare } from "@/lib/fare-engine";
import { isWithinJamaica } from "@/lib/jamaica";

/**
 * POST /api/rider/route-taxi/hail
 *
 * Rider hails a route taxi on a known TA route. Inserts a `route_hails`
 * row in `requested` state — the matcher (Phase 2) attaches it to the
 * next active driver session on the same route.
 *
 * Wallet gate: we refuse the hail if the rider doesn't have enough
 * balance to cover the fare. The actual debit happens at completion,
 * but blocking up front is the only way to honour the cashless rule
 * (no "pay later, hope it clears" gap).
 *
 * Body:
 *   { routeId: string, concession?: boolean }
 *
 * Pickup/dropoff names default to the route's origin/destination — the
 * "leg" override (rider boarding mid-route) lands in Phase 2.
 */
type HailBody = {
  routeId?: string;
  concession?: boolean;
  /** Optional — rider's current GPS, used so the matched driver knows
   *  where to find them and the matcher can sort hails closest-first.
   *  When omitted, the route's origin name is the only pickup hint. */
  pickupLat?: number;
  pickupLng?: number;
};

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: HailBody;
  try {
    body = (await request.json()) as HailBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.routeId) {
    return NextResponse.json({ error: "routeId is required" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select(
      "id, origin_name, destination_name, origin_parish, destination_parish, distance_km, ta_fare_jmd",
    )
    .eq("id", body.routeId)
    .eq("active", true)
    .maybeSingle();

  if (routeError) {
    return NextResponse.json({ error: routeError.message }, { status: 500 });
  }
  if (!route) {
    return NextResponse.json({ error: "route not found" }, { status: 404 });
  }

  const distanceKm = Number(route.distance_km);
  const formulaFare = calculateRouteFare(distanceKm);
  const taFare = (route as { ta_fare_jmd: number }).ta_fare_jmd;
  const baseFare = taFare > 0 ? taFare : formulaFare;
  const concession = body.concession === true;
  const fareJmd = concession ? Math.round(baseFare / 2) : baseFare;

  // Optional rider pickup GPS. Validated as plausibly inside Jamaica
  // so a stuck-on-zero or wrong-country fix can't poison the matcher.
  // When the rider declined location share, we leave the hail's
  // pickup_lat/lng at 0 — drivers fall back to "no proximity hint."
  let pickupLat = 0;
  let pickupLng = 0;
  if (
    typeof body.pickupLat === "number" &&
    typeof body.pickupLng === "number"
  ) {
    if (!isWithinJamaica({ lat: body.pickupLat, lng: body.pickupLng })) {
      return NextResponse.json(
        {
          error: "out_of_bounds",
          message: "Pickup coordinates are outside Jamaica.",
        },
        { status: 400 },
      );
    }
    pickupLat = body.pickupLat;
    pickupLng = body.pickupLng;
  }

  // Cashless gate. Don't let a hail leave the door if the rider can't
  // cover it — they'll be sent to the wallet top-up screen.
  if (!(await hasSufficientBalance(supabase, user.id, fareJmd))) {
    return NextResponse.json(
      {
        error: "insufficient_balance",
        message: `Top up your wallet — this trip costs JMD $${fareJmd}.`,
        fareJmd,
      },
      { status: 402 },
    );
  }

  const { data: hail, error: hailError } = await supabase
    .from("route_hails")
    .insert({
      rider_id: user.id,
      route_id: route.id,
      session_id: null, // matcher attaches in Phase 2
      pickup_name: route.origin_name,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      pickup_parish: route.origin_parish,
      dropoff_name: route.destination_name,
      dropoff_lat: 0,
      dropoff_lng: 0,
      dropoff_parish: route.destination_parish,
      distance_km: distanceKm,
      fare_jmd: fareJmd,
      concession,
      status: "requested",
    })
    .select("id, status, fare_jmd, requested_at")
    .single();

  if (hailError || !hail) {
    return NextResponse.json(
      { error: hailError?.message ?? "failed to create hail" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    hail: {
      id: hail.id,
      status: hail.status,
      fareJmd: hail.fare_jmd,
      requestedAt: hail.requested_at,
    },
    route: {
      id: route.id,
      origin: route.origin_name,
      destination: route.destination_name,
    },
  });
}
