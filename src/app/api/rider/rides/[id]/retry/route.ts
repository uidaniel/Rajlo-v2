import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { computeRideExpiry, EXPIRED_REASON } from "@/lib/ride-expiry";

/**
 * POST /api/rider/rides/[id]/retry
 *
 * Clone a cancelled ride into a fresh `requested` row. Used when
 * the original request expired without a match — instead of
 * making the rider re-enter pickup, dropoff, and seats, we
 * resubmit the same parameters server-side.
 *
 * Rules:
 *   - Caller must be the rider on the source ride
 *   - Source ride must be in `cancelled` state
 *   - Rider must not have another in-flight ride (no double-booking)
 *
 * Returns the new ride id; client refetches /rider/rides/active to
 * land on the live-trip view with the new request.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  // Source ride. Must belong to this rider AND be in a terminal
  // cancelled state — we don't want to clone an active ride
  // (would double-book the rider) or someone else's ride.
  const { data: source } = await supabase
    .from("rides")
    .select(
      "id, rider_id, status, cancellation_reason, pickup_name, pickup_address, pickup_lat, pickup_lng, pickup_parish, pickup_place_id, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, dropoff_parish, dropoff_place_id, seats, notes, estimated_fare_jmd, estimated_distance_km, estimated_eta_minutes, allow_carpool",
    )
    .eq("id", id)
    .maybeSingle();

  if (!source) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }
  if (source.rider_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (source.status !== "cancelled") {
    return NextResponse.json(
      { error: "Only cancelled rides can be re-requested." },
      { status: 409 },
    );
  }

  // Reject if the rider already has an active ride — calling
  // /retry while a different active ride is in flight would
  // create a confusing double-booking.
  const { data: existingActive } = await supabase
    .from("rides")
    .select("id")
    .eq("rider_id", user.id)
    .in("status", ["requested", "accepted", "arrived", "in_progress"])
    .limit(1)
    .maybeSingle();
  if (existingActive) {
    return NextResponse.json(
      { error: "You already have an active ride." },
      { status: 409 },
    );
  }

  // Clone. Same fields the original create endpoint sets, minus
  // the timeline timestamps (those reset for the fresh request).
  const { data: created, error: insertError } = await supabase
    .from("rides")
    .insert({
      rider_id: user.id,
      status: "requested",
      pickup_name: source.pickup_name,
      pickup_address: source.pickup_address,
      pickup_lat: source.pickup_lat,
      pickup_lng: source.pickup_lng,
      pickup_parish: source.pickup_parish,
      pickup_place_id: source.pickup_place_id,
      dropoff_name: source.dropoff_name,
      dropoff_address: source.dropoff_address,
      dropoff_lat: source.dropoff_lat,
      dropoff_lng: source.dropoff_lng,
      dropoff_parish: source.dropoff_parish,
      dropoff_place_id: source.dropoff_place_id,
      seats: source.seats,
      notes: source.notes,
      estimated_fare_jmd: source.estimated_fare_jmd,
      estimated_distance_km: source.estimated_distance_km,
      estimated_eta_minutes: source.estimated_eta_minutes,
      allow_carpool: source.allow_carpool,
      expires_at: computeRideExpiry(),
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message ?? "Couldn't re-request ride" },
      { status: 500 },
    );
  }

  // Copy stops too. Same position-ordering as the source.
  const { data: stops } = await supabase
    .from("ride_stops")
    .select("position, name, address, lat, lng, parish, place_id")
    .eq("ride_id", source.id)
    .order("position", { ascending: true });
  if (stops && stops.length > 0) {
    await supabase.from("ride_stops").insert(
      stops.map((s) => ({
        ride_id: created.id,
        position: s.position,
        name: s.name,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        parish: s.parish,
        place_id: s.place_id,
      })),
    );
  }

  // Audit — link the new ride to the cloned source so support can
  // see "this is a retry of ride X" later.
  await supabase.from("ride_events").insert({
    ride_id: created.id,
    event: "requested",
    actor_role: "rider",
    actor_id: user.id,
    metadata: {
      retryOf: source.id,
      sourceCancellationReason: source.cancellation_reason,
      isRetryOfExpired: source.cancellation_reason === EXPIRED_REASON,
    },
  });

  return NextResponse.json({ ok: true, rideId: created.id });
}
