import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/rider/rides/active
 *
 * Returns the rider's currently-active ride (status in
 * requested | accepted | arrived | in_progress) if any, plus the
 * assigned driver's display info.
 *
 * If multiple rides somehow match (shouldn't in practice — riders only
 * have one active trip at a time), returns the most recently requested.
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

  const { data: ride } = await supabase
    .from("rides")
    .select(
      "id, status, driver_id, pickup_name, pickup_address, pickup_lat, pickup_lng, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, seats, notes, estimated_fare_jmd, estimated_distance_km, estimated_eta_minutes, requested_at, accepted_at, arrived_at, started_at",
    )
    .eq("rider_id", user.id)
    .in("status", ["requested", "accepted", "arrived", "in_progress"])
    .order("requested_at", { ascending: false })
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

  let driver: {
    name: string;
    plateNumber: string | null;
    vehicle: string | null;
    rating: number;
    avatarUrl: string | null;
  } | null = null;

  if (ride.driver_id) {
    const { data: d } = await supabase
      .from("drivers")
      .select(
        "first_name, last_name, plate_number, vehicle_make, vehicle_model, user_id",
      )
      .eq("id", ride.driver_id)
      .maybeSingle();
    if (d) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", d.user_id)
        .maybeSingle();
      driver = {
        name:
          [d.first_name, d.last_name].filter(Boolean).join(" ") || "Driver",
        plateNumber: d.plate_number,
        vehicle:
          d.vehicle_make && d.vehicle_model
            ? `${d.vehicle_make} ${d.vehicle_model}`
            : null,
        rating: 4.9,
        avatarUrl: profile?.avatar_url ?? null,
      };
    }
  }

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
    driver,
  });
}
