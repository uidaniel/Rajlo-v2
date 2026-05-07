import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { haversineKm } from "@/lib/jamaica";

/**
 * GET /api/driver/inbox
 *
 * Returns the list of `requested` rides a signed-in driver can accept.
 * Only activated drivers see anything — onboarding/rejected/deactivated
 * drivers get an empty list.
 *
 * For each pending ride we also include `distanceKmFromDriver` if the driver
 * has a known location (Phase 2A.2 will hook this up to live GPS — for now
 * we use the driver's most recent ride pickup as a rough proxy, falling
 * back to null).
 *
 * Sorted oldest-requested-first so the driver who's been waiting longest
 * gets matched first.
 */

export async function GET(request: Request) {
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

  // Confirm signed-in user is an activated driver.
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, activated, onboarding_status, deactivated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!driver.activated || driver.deactivated_at) {
    return NextResponse.json({
      rides: [],
      driver: { activated: false },
    });
  }

  // Pending requests — RLS already filters to "open" rides, but we add the
  // explicit `eq` for clarity + to allow the same code path through
  // service_role (which bypasses RLS).
  const { data: rides, error } = await supabase
    .from("rides")
    .select(
      "id, pickup_name, pickup_address, pickup_lat, pickup_lng, pickup_parish, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, dropoff_parish, seats, notes, estimated_fare_jmd, estimated_distance_km, estimated_eta_minutes, requested_at",
    )
    .eq("status", "requested")
    .is("driver_id", null)
    .order("requested_at", { ascending: true })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with stop counts so the UI can show "+ 2 stops" pills.
  const rideIds = (rides ?? []).map((r) => r.id);
  let stopCounts = new Map<string, number>();
  if (rideIds.length > 0) {
    const { data: stopsAgg } = await supabase
      .from("ride_stops")
      .select("ride_id")
      .in("ride_id", rideIds);
    stopCounts = (stopsAgg ?? []).reduce((acc, row) => {
      acc.set(row.ride_id, (acc.get(row.ride_id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  }

  // Optional: caller can pass ?lat=&lng= so we compute distance from the
  // driver's current position. Otherwise distance is null.
  const url = new URL(request.url);
  const driverLat = Number(url.searchParams.get("lat"));
  const driverLng = Number(url.searchParams.get("lng"));
  const hasDriverPosition =
    Number.isFinite(driverLat) && Number.isFinite(driverLng);

  return NextResponse.json({
    driver: { id: driver.id, activated: true },
    rides: (rides ?? []).map((r) => ({
      id: r.id,
      pickup: {
        name: r.pickup_name,
        address: r.pickup_address,
        parish: r.pickup_parish,
        lat: r.pickup_lat,
        lng: r.pickup_lng,
      },
      dropoff: {
        name: r.dropoff_name,
        address: r.dropoff_address,
        parish: r.dropoff_parish,
        lat: r.dropoff_lat,
        lng: r.dropoff_lng,
      },
      stopsCount: stopCounts.get(r.id) ?? 0,
      seats: r.seats,
      notes: r.notes,
      estimatedFareJMD: r.estimated_fare_jmd,
      estimatedDistanceKm: r.estimated_distance_km,
      estimatedEtaMinutes: r.estimated_eta_minutes,
      requestedAt: r.requested_at,
      distanceKmFromDriver: hasDriverPosition
        ? Number(
            haversineKm(
              { lat: driverLat, lng: driverLng },
              { lat: r.pickup_lat, lng: r.pickup_lng },
            ).toFixed(2),
          )
        : null,
    })),
  });
}
