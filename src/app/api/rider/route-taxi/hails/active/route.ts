import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/rider/route-taxi/hails/active
 *
 * Returns the rider's currently in-flight Route Taxi hail (if any) —
 * the one where they're waiting on a driver, en route, or onboard.
 * Drives the rider's "live status" surface so they can see "Driver
 * accepted · ETA 4 min · plate AV1234" without a page refresh.
 *
 * `null` means "no active hail — show the catalogue picker."
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
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const { data: hail } = await supabase
    .from("route_hails")
    .select(
      "id, route_id, session_id, status, pickup_name, dropoff_name, distance_km, fare_jmd, concession, requested_at, accepted_at, picked_up_at",
    )
    .eq("rider_id", user.id)
    .in("status", ["requested", "accepted", "picked_up"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!hail) {
    return NextResponse.json({ hail: null });
  }

  // If the hail has a session, join driver basics so the rider sees who's coming.
  let sessionInfo = null as null | {
    id: string;
    seatsTaken: number;
    vehicleCapacity: number;
    currentLat: number | null;
    currentLng: number | null;
    lastPositionAt: string | null;
    driver: {
      firstName: string | null;
      plateNumber: string | null;
      vehicleMake: string | null;
      vehicleModel: string | null;
      vehicleColor: string | null;
    } | null;
  };

  if (hail.session_id) {
    const { data: session } = await supabase
      .from("driver_sessions")
      .select(
        "id, driver_id, seats_taken, vehicle_capacity, current_lat, current_lng, last_position_at",
      )
      .eq("id", hail.session_id)
      .maybeSingle();

    if (session) {
      const { data: driver } = await supabase
        .from("drivers")
        .select(
          "first_name, plate_number, vehicle_make, vehicle_model, vehicle_color",
        )
        .eq("id", session.driver_id)
        .maybeSingle();

      sessionInfo = {
        id: session.id,
        seatsTaken: session.seats_taken,
        vehicleCapacity: session.vehicle_capacity,
        currentLat: session.current_lat,
        currentLng: session.current_lng,
        lastPositionAt: session.last_position_at,
        driver: driver
          ? {
              firstName: driver.first_name,
              plateNumber: driver.plate_number,
              vehicleMake: driver.vehicle_make,
              vehicleModel: driver.vehicle_model,
              vehicleColor: driver.vehicle_color,
            }
          : null,
      };
    }
  }

  return NextResponse.json({
    hail: {
      id: hail.id,
      routeId: hail.route_id,
      status: hail.status,
      pickup: hail.pickup_name,
      dropoff: hail.dropoff_name,
      distanceKm: Number(hail.distance_km),
      fareJmd: hail.fare_jmd,
      concession: hail.concession,
      requestedAt: hail.requested_at,
      acceptedAt: hail.accepted_at,
      pickedUpAt: hail.picked_up_at,
      session: sessionInfo,
    },
  });
}
