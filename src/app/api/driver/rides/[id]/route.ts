import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/driver/rides/[id]
 *
 * Returns the full record for a single ride the driver was assigned to.
 * Used by the driver-side trip detail page (driver/history/[rideId]).
 *
 * Driver can only fetch rides they were the driver_id on — service role
 * + an explicit `driver_id = self` check. Returns 404 (not 403) for
 * mismatches so we don't leak existence of other drivers' rides.
 *
 * Shape mirrors the rider variant at /api/rider/rides/[id] but the
 * rider/driver perspectives are swapped: this returns the RIDER's
 * profile + the rating the RIDER gave this trip, plus the driver's
 * own rating of the rider (if they've submitted one).
 */

export const dynamic = "force-dynamic";

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

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: ride, error } = await supabase
    .from("rides")
    .select(
      "id, status, rider_id, driver_id, pickup_name, pickup_address, pickup_lat, pickup_lng, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, seats, notes, estimated_fare_jmd, final_fare_jmd, estimated_distance_km, estimated_eta_minutes, requested_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at, cancellation_reason",
    )
    .eq("id", id)
    .eq("driver_id", driver.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!ride) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Stops (multi-leg trips).
  const { data: stopRows } = await supabase
    .from("ride_stops")
    .select("position, name, address, lat, lng")
    .eq("ride_id", ride.id)
    .order("position", { ascending: true });

  // Rider profile + their lifetime rating.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, avatar_url")
    .eq("id", ride.rider_id)
    .maybeSingle();

  // Rider's lifetime rating average (across all trips others have rated
  // them on). Same source the driver inbox uses.
  const { data: riderRatings } = await supabase
    .from("ride_ratings")
    .select("stars")
    .eq("rated_id", ride.rider_id);
  const riderRating =
    riderRatings && riderRatings.length > 0
      ? riderRatings.reduce((a, r) => a + (r.stars as number), 0) /
        riderRatings.length
      : null;
  const riderRatingCount = riderRatings?.length ?? 0;

  // Ratings on THIS ride.
  const { data: tripRatings } = await supabase
    .from("ride_ratings")
    .select("rater_id, rated_id, stars, comment")
    .eq("ride_id", ride.id);

  // What the rider gave THIS driver.
  const riderToDriver =
    tripRatings?.find(
      (r) =>
        r.rater_id === ride.rider_id && r.rated_id === user.id,
    ) ?? null;
  // What the driver gave the rider (if they did).
  const driverToRider =
    tripRatings?.find(
      (r) =>
        r.rater_id === user.id && r.rated_id === ride.rider_id,
    ) ?? null;

  return NextResponse.json({
    ride: {
      id: ride.id as string,
      status: ride.status as string,
      pickup: {
        name: ride.pickup_name as string,
        address: (ride.pickup_address as string | null) ?? ride.pickup_name,
        lat: Number(ride.pickup_lat),
        lng: Number(ride.pickup_lng),
      },
      dropoff: {
        name: ride.dropoff_name as string,
        address: (ride.dropoff_address as string | null) ?? ride.dropoff_name,
        lat: Number(ride.dropoff_lat),
        lng: Number(ride.dropoff_lng),
      },
      stops: (stopRows ?? []).map((s) => ({
        position: s.position as number,
        name: s.name as string,
        address: (s.address as string | null) ?? s.name,
        lat: Number(s.lat),
        lng: Number(s.lng),
      })),
      seats: (ride.seats as number) ?? 1,
      notes: (ride.notes as string | null) ?? null,
      fareJMD: Number(ride.final_fare_jmd ?? ride.estimated_fare_jmd ?? 0),
      estimatedDistanceKm: (ride.estimated_distance_km as number | null) ?? null,
      estimatedEtaMinutes: (ride.estimated_eta_minutes as number | null) ?? null,
      timeline: {
        requestedAt: (ride.requested_at as string | null) ?? null,
        acceptedAt: (ride.accepted_at as string | null) ?? null,
        arrivedAt: (ride.arrived_at as string | null) ?? null,
        startedAt: (ride.started_at as string | null) ?? null,
        completedAt: (ride.completed_at as string | null) ?? null,
        cancelledAt: (ride.cancelled_at as string | null) ?? null,
      },
      cancellationReason: (ride.cancellation_reason as string | null) ?? null,
    },
    rider: profile
      ? {
          id: profile.id as string,
          name: (profile.full_name as string | null) ?? "Rider",
          phone: (profile.phone as string | null) ?? null,
          avatarUrl: (profile.avatar_url as string | null) ?? null,
          rating: riderRating,
          ratingCount: riderRatingCount,
        }
      : null,
    /** Rider's rating of THIS driver on THIS trip (null if not rated). */
    riderRating: riderToDriver
      ? {
          stars: riderToDriver.stars as number,
          comment: (riderToDriver.comment as string | null) ?? null,
        }
      : null,
    /** Driver's own rating of the rider on this trip (null if not rated). */
    driverRating: driverToRider
      ? {
          stars: driverToRider.stars as number,
          comment: (driverToRider.comment as string | null) ?? null,
        }
      : null,
  });
}
