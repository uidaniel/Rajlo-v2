import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/driver/rides/active
 *
 * Returns the signed-in driver's currently in-flight ride if any
 * (status in accepted | arrived | in_progress), otherwise null. Used by
 * the driver's active-trip page to know which ride to render.
 *
 * Includes rider profile + intermediate stops so the UI has everything
 * it needs in one round trip.
 */

export async function GET() {
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

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: ride } = await supabase
    .from("rides")
    .select(
      "id, status, rider_id, pickup_name, pickup_address, pickup_lat, pickup_lng, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, seats, notes, estimated_fare_jmd, estimated_distance_km, estimated_eta_minutes, requested_at, accepted_at, arrived_at, started_at",
    )
    .eq("driver_id", driver.id)
    .in("status", ["accepted", "arrived", "in_progress"])
    .order("accepted_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!ride) {
    return NextResponse.json({ ride: null });
  }

  const { data: stops } = await supabase
    .from("ride_stops")
    .select("position, name, address, lat, lng")
    .eq("ride_id", ride.id)
    .order("position", { ascending: true });

  // Rider profile (name + avatar) so the driver sees who they're picking up.
  const { data: riderProfile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", ride.rider_id)
    .maybeSingle();

  return NextResponse.json({
    ride: {
      id: ride.id,
      status: ride.status,
      pickup: {
        name: ride.pickup_name,
        address: ride.pickup_address,
        lat: ride.pickup_lat,
        lng: ride.pickup_lng,
      },
      dropoff: {
        name: ride.dropoff_name,
        address: ride.dropoff_address,
        lat: ride.dropoff_lat,
        lng: ride.dropoff_lng,
      },
      stops: stops ?? [],
      seats: ride.seats,
      notes: ride.notes,
      estimatedFareJMD: ride.estimated_fare_jmd,
      estimatedDistanceKm: ride.estimated_distance_km,
      estimatedEtaMinutes: ride.estimated_eta_minutes,
      timeline: {
        requestedAt: ride.requested_at,
        acceptedAt: ride.accepted_at,
        arrivedAt: ride.arrived_at,
        startedAt: ride.started_at,
      },
    },
    rider: {
      name: riderProfile?.full_name ?? "Rider",
      avatarUrl: riderProfile?.avatar_url ?? null,
    },
  });
}
