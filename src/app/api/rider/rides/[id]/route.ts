import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getAverageRating } from "@/lib/ratings";
import { getDriverSelfieUrl } from "@/lib/driver-selfie";

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
      "id, status, rider_id, driver_id, pickup_name, pickup_address, pickup_lat, pickup_lng, pickup_place_id, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, dropoff_place_id, seats, notes, estimated_fare_jmd, estimated_distance_km, estimated_eta_minutes, requested_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at, cancellation_reason",
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
    phone: string | null;
    plateNumber: string | null;
    vehicle: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleYear: number | null;
    vehicleColor: string | null;
    /** null = no ratings yet (UI shows "new driver" pill instead). */
    rating: number | null;
    ratingCount: number;
    avatarUrl: string | null;
  } | null = null;

  // Did this rider already rate this trip? Surface it so the detail
  // page can hide the "Rate the driver" CTA and instead show the
  // existing rating. The DB unique constraint on (ride_id, rater_role)
  // already blocks a second insert; this lookup is so the UI doesn't
  // even let the rider try (and avoids the 409 round-trip).
  let myRating: {
    stars: number;
    comment: string | null;
    createdAt: string;
  } | null = null;
  const { data: existingRating } = await supabase
    .from("ride_ratings")
    .select("stars, comment, created_at")
    .eq("ride_id", id)
    .eq("rater_id", user.id)
    .eq("rater_role", "rider")
    .maybeSingle();
  if (existingRating) {
    myRating = {
      stars: existingRating.stars,
      comment: existingRating.comment,
      createdAt: existingRating.created_at,
    };
  }

  if (ride.driver_id) {
    const { data: d } = await supabase
      .from("drivers")
      .select(
        "first_name, last_name, phone, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_color, user_id",
      )
      .eq("id", ride.driver_id)
      .maybeSingle();

    if (d) {
      // OAuth pic + rating + verified TA selfie, parallel.
      const [{ data: profile }, ratingSummary, selfieUrl] = await Promise.all([
        supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", d.user_id)
          .maybeSingle(),
        getAverageRating(supabase, d.user_id, "driver"),
        getDriverSelfieUrl(supabase, ride.driver_id),
      ]);

      const vehicleParts = [
        d.vehicle_year ? String(d.vehicle_year) : null,
        d.vehicle_color,
        d.vehicle_make,
        d.vehicle_model,
      ].filter(Boolean);

      driver = {
        name:
          [d.first_name, d.last_name].filter(Boolean).join(" ") || "Driver",
        phone: d.phone,
        plateNumber: d.plate_number,
        vehicle: vehicleParts.length > 0 ? vehicleParts.join(" ") : null,
        vehicleMake: d.vehicle_make,
        vehicleModel: d.vehicle_model,
        vehicleYear: d.vehicle_year,
        vehicleColor: d.vehicle_color,
        rating: ratingSummary.average,
        ratingCount: ratingSummary.count,
        // Verified TA selfie wins over the OAuth picture.
        avatarUrl: selfieUrl ?? profile?.avatar_url ?? null,
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
        placeId: ride.pickup_place_id,
      },
      dropoff: {
        name: ride.dropoff_name,
        address: ride.dropoff_address,
        lat: ride.dropoff_lat,
        lng: ride.dropoff_lng,
        placeId: ride.dropoff_place_id,
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
    myRating,
  });
}
