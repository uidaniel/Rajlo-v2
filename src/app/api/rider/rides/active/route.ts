import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getAverageRating } from "@/lib/ratings";

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
      "id, status, driver_id, pickup_name, pickup_address, pickup_lat, pickup_lng, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, seats, notes, estimated_fare_jmd, estimated_distance_km, estimated_eta_minutes, requested_at, accepted_at, arrived_at, started_at, carpool_group_id",
    )
    .eq("rider_id", user.id)
    .in("status", ["requested", "accepted", "arrived", "in_progress"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ride) {
    return NextResponse.json({ ride: null });
  }

  // If this rider's trip is part of a carpool, surface the partner's
  // first name so the live-trip UI can render a "sharing with X"
  // badge. We deliberately DON'T expose the partner's pickup/dropoff —
  // that's privileged info the driver needs but other riders don't.
  let carpoolPartnerFirstName: string | null = null;
  if (ride.carpool_group_id) {
    const { data: partner } = await supabase
      .from("rides")
      .select("rider_id")
      .eq("carpool_group_id", ride.carpool_group_id)
      .neq("id", ride.id)
      .maybeSingle();
    if (partner?.rider_id) {
      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", partner.rider_id)
        .maybeSingle();
      // First name only — last names aren't useful for the rider and
      // err on the side of less PII exposure.
      carpoolPartnerFirstName =
        partnerProfile?.full_name?.split(" ")[0] ?? null;
    }
  }

  const { data: stops } = await supabase
    .from("ride_stops")
    .select("position, name, address, lat, lng")
    .eq("ride_id", ride.id)
    .order("position", { ascending: true });

  let driver: {
    name: string;
    phone: string | null;
    plateNumber: string | null;
    /** Combined vehicle string: "2020 Silver Toyota Probox" — handy when
     *  the UI just wants one line. Null only if make + model are both empty. */
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

  if (ride.driver_id) {
    const { data: d } = await supabase
      .from("drivers")
      .select(
        "first_name, last_name, phone, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_color, user_id",
      )
      .eq("id", ride.driver_id)
      .maybeSingle();
    if (d) {
      const [{ data: profile }, ratingSummary] = await Promise.all([
        supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", d.user_id)
          .maybeSingle(),
        getAverageRating(supabase, d.user_id, "driver"),
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
      carpool: ride.carpool_group_id
        ? {
            groupId: ride.carpool_group_id,
            partnerFirstName: carpoolPartnerFirstName,
          }
        : null,
    },
    driver,
  });
}
