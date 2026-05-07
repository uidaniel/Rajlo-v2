import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/rider/rides/[id]
 *
 * Returns the rider's ride + assigned driver (if any) + intermediate stops.
 * Used by the rider's "looking for a driver" / live-trip pages to poll
 * status until the driver accepts.
 *
 * Riders can only see their own rides — enforced both by the rider_id
 * filter on the SELECT below AND by the rides RLS policy.
 */

export async function GET(
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

  const { data: ride, error: rideError } = await supabase
    .from("rides")
    .select(
      "id, status, rider_id, driver_id, pickup_name, pickup_address, pickup_lat, pickup_lng, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, seats, notes, estimated_fare_jmd, estimated_distance_km, estimated_eta_minutes, requested_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at, cancellation_reason",
    )
    .eq("id", id)
    .eq("rider_id", user.id)
    .maybeSingle();

  if (rideError) {
    return NextResponse.json({ error: rideError.message }, { status: 500 });
  }
  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  // Stops in position order
  const { data: stops } = await supabase
    .from("ride_stops")
    .select("position, name, address, lat, lng, arrived_at, departed_at")
    .eq("ride_id", id)
    .order("position", { ascending: true });

  // If a driver has been assigned, pull the driver's display details so the
  // rider sees who's picking them up.
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
      // Pull avatar from the driver's profile (synced from Google OAuth).
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
        // Rating system lands later — placeholder so the UI has a value.
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
        completedAt: ride.completed_at,
        cancelledAt: ride.cancelled_at,
      },
      cancellationReason: ride.cancellation_reason,
    },
    driver,
  });
}
