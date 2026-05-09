import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getAverageRating } from "@/lib/ratings";
import { haversineKm } from "@/lib/jamaica";

/**
 * GET /api/driver/requests/[id]
 *
 * Full read-only payload for a single open ride request — the
 * before-accept detail page on the driver portal hits this. Verifies
 * the caller is an activated driver, then returns:
 *
 *   - The ride (pickup, dropoff, intermediate stops, fare, etc.)
 *   - The rider's display name + average rating + total trips
 *   - The carpool partner's ride (when this request is part of a
 *     carpool group), so the driver sees both pickups before they
 *     commit
 *   - A small distance-from-driver hint (same approximation the
 *     inbox endpoint uses)
 *
 * Returns:
 *   200 → full payload
 *   403 → caller isn't an activated driver
 *   404 → ride not found
 *   410 → ride is no longer open (someone else accepted, or it
 *         expired) — the page surfaces "this request was taken"
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

  // Confirm caller is an activated driver.
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, activated, deactivated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!driver.activated || driver.deactivated_at) {
    return NextResponse.json(
      { error: "Your driver account isn't currently active" },
      { status: 403 },
    );
  }

  // Pull the ride.
  const { data: ride, error } = await supabase
    .from("rides")
    .select(
      "id, status, driver_id, rider_id, pickup_name, pickup_address, pickup_lat, pickup_lng, pickup_parish, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, dropoff_parish, seats, notes, estimated_fare_jmd, estimated_distance_km, estimated_eta_minutes, requested_at, expires_at, carpool_group_id, carpool_role",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }
  if (ride.status !== "requested" || ride.driver_id !== null) {
    // Someone else accepted, or it transitioned to expired/cancelled.
    return NextResponse.json(
      { error: "This request is no longer open." },
      { status: 410 },
    );
  }
  if (ride.expires_at && new Date(ride.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This request expired before a driver picked it up." },
      { status: 410 },
    );
  }

  // Pull intermediate stops in order.
  const { data: stopRows } = await supabase
    .from("ride_stops")
    .select("position, name, address, lat, lng, parish")
    .eq("ride_id", id)
    .order("position", { ascending: true });

  // Rider profile + rating.
  const { data: riderProfile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", ride.rider_id)
    .maybeSingle();
  const ratingSummary = await getAverageRating(
    supabase,
    ride.rider_id,
    "rider",
  );
  const { count: tripCount } = await supabase
    .from("rides")
    .select("id", { count: "exact", head: true })
    .eq("rider_id", ride.rider_id)
    .eq("status", "completed");

  // If carpool, pull the partner ride so the driver sees both pickups.
  let partner: PartnerRide | null = null;
  if (ride.carpool_group_id) {
    const { data: groupRides } = await supabase
      .from("rides")
      .select(
        "id, rider_id, pickup_name, pickup_address, pickup_lat, pickup_lng, pickup_parish, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, dropoff_parish, seats, estimated_fare_jmd, carpool_role",
      )
      .eq("carpool_group_id", ride.carpool_group_id);
    const otherRow = (groupRides ?? []).find((r) => r.id !== id);
    if (otherRow) {
      const { data: otherProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", otherRow.rider_id)
        .maybeSingle();
      partner = {
        rideId: otherRow.id,
        carpoolRole: otherRow.carpool_role as "primary" | "secondary" | null,
        riderName: (otherProfile?.full_name as string | null) ?? "Rider",
        pickup: {
          name: otherRow.pickup_name,
          address: otherRow.pickup_address,
          parish: otherRow.pickup_parish,
          lat: otherRow.pickup_lat,
          lng: otherRow.pickup_lng,
        },
        dropoff: {
          name: otherRow.dropoff_name,
          address: otherRow.dropoff_address,
          parish: otherRow.dropoff_parish,
          lat: otherRow.dropoff_lat,
          lng: otherRow.dropoff_lng,
        },
        seats: otherRow.seats,
        fareJmd: otherRow.estimated_fare_jmd,
      };
    }
  }

  // Approximate distance from driver — same trick as the inbox
  // endpoint: use the driver's most recent ride pickup as a proxy
  // for "where they are." Phase 2A.2 will swap this for live GPS.
  const { data: lastDriverRide } = await supabase
    .from("rides")
    .select("pickup_lat, pickup_lng")
    .eq("driver_id", driver.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const distanceFromDriverKm = lastDriverRide
    ? Number(
        haversineKm(
          {
            lat: (lastDriverRide as { pickup_lat: number }).pickup_lat,
            lng: (lastDriverRide as { pickup_lng: number }).pickup_lng,
          },
          { lat: ride.pickup_lat, lng: ride.pickup_lng },
        ).toFixed(2),
      )
    : null;

  return NextResponse.json({
    ride: {
      id: ride.id,
      status: ride.status,
      pickup: {
        name: ride.pickup_name,
        address: ride.pickup_address,
        parish: ride.pickup_parish,
        lat: ride.pickup_lat,
        lng: ride.pickup_lng,
      },
      dropoff: {
        name: ride.dropoff_name,
        address: ride.dropoff_address,
        parish: ride.dropoff_parish,
        lat: ride.dropoff_lat,
        lng: ride.dropoff_lng,
      },
      stops: stopRows ?? [],
      seats: ride.seats,
      notes: ride.notes,
      estimatedFareJmd: ride.estimated_fare_jmd,
      estimatedDistanceKm: ride.estimated_distance_km,
      estimatedEtaMinutes: ride.estimated_eta_minutes,
      requestedAt: ride.requested_at,
      expiresAt: ride.expires_at,
      carpoolGroupId: ride.carpool_group_id,
      carpoolRole: ride.carpool_role,
      distanceFromDriverKm,
    },
    rider: {
      id: ride.rider_id,
      // We expose first name only — no need for a driver to see the
      // rider's full surname before accepting.
      firstName: ((riderProfile?.full_name as string | null) ?? "Rider").split(
        " ",
      )[0],
      averageRating: ratingSummary.average,
      ratingCount: ratingSummary.count,
      completedTrips: tripCount ?? 0,
    },
    partner,
    // The wallet system is the only payment path today — every ride
    // is paid out of the rider's pre-funded wallet. We surface this
    // explicitly so the UI can render a "Payment · Wallet" row
    // without inferring it.
    payment: { method: "wallet" as const },
  });
}

type PartnerRide = {
  rideId: string;
  carpoolRole: "primary" | "secondary" | null;
  riderName: string;
  pickup: {
    name: string;
    address: string;
    parish: string | null;
    lat: number;
    lng: number;
  };
  dropoff: {
    name: string;
    address: string;
    parish: string | null;
    lat: number;
    lng: number;
  };
  seats: number;
  fareJmd: number;
};
