import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { tryMatchCarpool } from "@/lib/carpool-matcher";

/**
 * POST /api/rider/rides
 *
 * Rider creates a new ride request.
 *
 * Body shape:
 *   {
 *     pickup:  { name, address, lat, lng, parish?, placeId? }
 *     dropoff: { name, address, lat, lng, parish?, placeId? }
 *     stops:   [{ name, address, lat, lng, parish?, placeId? }, ...]
 *     seats:   1..4
 *     notes?:  string
 *     fare:    { totalKm, etaMinutes, fareJMD }
 *   }
 *
 * Response: { ok, rideId }
 *
 * Server-side validation: signed in, rider role, pickup + dropoff present.
 * The actual ride row + stops are inserted with `service_role` so RLS
 * policies don't fight a multi-step transaction.
 */

type PlacePayload = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  parish?: string | null;
  placeId?: string | null;
};

type CreateRideRequest = {
  pickup: PlacePayload;
  dropoff: PlacePayload;
  stops: PlacePayload[];
  seats: number;
  notes?: string;
  fare: {
    totalKm: number;
    etaMinutes: number;
    fareJMD: number;
  };
  /** Phase 2A.3: rider opted into carpool/ride-share. When true, the
   *  server tries to match this ride with another opt-in ride going
   *  the same way and reduces the fare on both. */
  allowCarpool?: boolean;
};

function isPlace(p: unknown): p is PlacePayload {
  if (!p || typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  return (
    typeof x.name === "string" &&
    typeof x.address === "string" &&
    typeof x.lat === "number" &&
    typeof x.lng === "number"
  );
}

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Only riders can create rides.
  const { data: profile } = await auth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "rider") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as CreateRideRequest;
  if (!isPlace(body?.pickup) || !isPlace(body?.dropoff)) {
    return NextResponse.json(
      { error: "Pickup and dropoff are required" },
      { status: 400 },
    );
  }
  const seats = Number(body.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 4) {
    return NextResponse.json(
      { error: "Seats must be between 1 and 4" },
      { status: 400 },
    );
  }
  const stops = Array.isArray(body.stops) ? body.stops.filter(isPlace) : [];
  if (stops.length > 4) {
    return NextResponse.json(
      { error: "Up to 4 intermediate stops allowed" },
      { status: 400 },
    );
  }
  if (
    !body.fare ||
    typeof body.fare.fareJMD !== "number" ||
    body.fare.fareJMD < 0
  ) {
    return NextResponse.json({ error: "Invalid fare" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Server is missing SUPABASE_SERVICE_ROLE_KEY — can't create ride.",
      },
      { status: 500 },
    );
  }

  const allowCarpool = body.allowCarpool === true;

  // Insert the ride row.
  const { data: ride, error: rideError } = await supabase
    .from("rides")
    .insert({
      rider_id: user.id,
      status: "requested",
      pickup_name: body.pickup.name,
      pickup_address: body.pickup.address,
      pickup_lat: body.pickup.lat,
      pickup_lng: body.pickup.lng,
      pickup_parish: body.pickup.parish ?? null,
      pickup_place_id: body.pickup.placeId ?? null,
      dropoff_name: body.dropoff.name,
      dropoff_address: body.dropoff.address,
      dropoff_lat: body.dropoff.lat,
      dropoff_lng: body.dropoff.lng,
      dropoff_parish: body.dropoff.parish ?? null,
      dropoff_place_id: body.dropoff.placeId ?? null,
      seats,
      notes: body.notes?.trim() || null,
      estimated_fare_jmd: Math.round(body.fare.fareJMD),
      estimated_distance_km: Number.isFinite(body.fare.totalKm)
        ? Number(body.fare.totalKm.toFixed(2))
        : null,
      estimated_eta_minutes: Number.isFinite(body.fare.etaMinutes)
        ? Math.round(body.fare.etaMinutes)
        : null,
      allow_carpool: allowCarpool,
    })
    .select(
      "id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, seats, estimated_fare_jmd",
    )
    .single();

  if (rideError || !ride) {
    return NextResponse.json(
      {
        error: `Failed to create ride: ${rideError?.message ?? "unknown error"}`,
      },
      { status: 500 },
    );
  }

  // Insert intermediate stops, position-ordered.
  if (stops.length > 0) {
    const stopRows = stops.map((s, i) => ({
      ride_id: ride.id,
      position: i + 1,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      parish: s.parish ?? null,
      place_id: s.placeId ?? null,
    }));
    const { error: stopsError } = await supabase
      .from("ride_stops")
      .insert(stopRows);
    if (stopsError) {
      // Cascading delete will clean up if we ever need to rollback. For now
      // surface the error — the ride row exists but is missing its stops.
      return NextResponse.json(
        { error: `Ride created but stops failed: ${stopsError.message}` },
        { status: 500 },
      );
    }
  }

  // Audit event.
  await supabase.from("ride_events").insert({
    ride_id: ride.id,
    event: "requested",
    actor_role: "rider",
    actor_id: user.id,
    metadata: {
      pickup: body.pickup.name,
      dropoff: body.dropoff.name,
      stops: stops.length,
      seats,
      estimatedFareJMD: Math.round(body.fare.fareJMD),
      allowCarpool,
    },
  });

  // Phase 2A.3 — try to pair this ride with another carpool opt-in
  // going the same way. If matched, both rides get linked + their
  // fares drop. If not matched, the ride stays as a normal solo
  // request and may still be matched later when another opt-in comes
  // in (the matcher runs again on every new ride).
  let matchedFareJMD: number | null = null;
  let matchedWithRiderId: string | null = null;
  if (allowCarpool) {
    const result = await tryMatchCarpool(supabase, ride);
    if (result) {
      matchedFareJMD = result.newFareJMD;
      matchedWithRiderId = result.partnerRiderId;
      // Audit on both sides so the events table tells the full story.
      await supabase.from("ride_events").insert([
        {
          ride_id: ride.id,
          event: "carpool_matched",
          actor_role: "system",
          metadata: {
            groupId: result.groupId,
            partnerRideId: result.partnerRideId,
            newFareJMD: result.newFareJMD,
          },
        },
        {
          ride_id: result.partnerRideId,
          event: "carpool_matched",
          actor_role: "system",
          metadata: {
            groupId: result.groupId,
            partnerRideId: ride.id,
            newFareJMD: result.partnerFareJMD,
          },
        },
      ]);
    }
  }

  return NextResponse.json({
    ok: true,
    rideId: ride.id,
    carpool: matchedFareJMD
      ? { matched: true, fareJMD: matchedFareJMD, partnerRiderId: matchedWithRiderId }
      : { matched: false },
  });
}
