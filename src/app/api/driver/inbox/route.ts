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
  //
  // `expires_at > now()` keeps rides past their timeout out of the
  // driver's view. The expire-on-read in /api/rider/rides/active
  // does the actual status flip, but this filter ensures a driver
  // never sees a ride that's effectively dead — even if the rider
  // hasn't refreshed their page recently. We also accept null
  // expires_at to play nice with rows from before the migration.
  const nowIso = new Date().toISOString();
  const { data: rides, error } = await supabase
    .from("rides")
    .select(
      "id, pickup_name, pickup_address, pickup_lat, pickup_lng, pickup_parish, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, dropoff_parish, seats, notes, estimated_fare_jmd, estimated_distance_km, estimated_eta_minutes, requested_at, carpool_group_id, carpool_role",
    )
    .eq("status", "requested")
    .is("driver_id", null)
    .or(`expires_at.gt.${nowIso},expires_at.is.null`)
    .order("requested_at", { ascending: true })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Collapse carpool groups: each group becomes a SINGLE inbox card so
  // the driver doesn't see "two requests" for what is in fact one
  // shared trip. We anchor on the primary ride (older) and attach the
  // partner's info to it. Solo (un-grouped) rides pass through as-is.
  type Row = NonNullable<typeof rides>[number];
  const soloRides: Row[] = [];
  const groupedByGroupId = new Map<string, Row[]>();
  for (const r of rides ?? []) {
    if (r.carpool_group_id) {
      const list = groupedByGroupId.get(r.carpool_group_id) ?? [];
      list.push(r);
      groupedByGroupId.set(r.carpool_group_id, list);
    } else {
      soloRides.push(r);
    }
  }

  // Enrich with stop counts so the UI can show "+ 2 stops" pills. Only
  // count stops for rides we'll actually emit in the response.
  const allEmittedRideIds = [
    ...soloRides.map((r) => r.id),
    ...Array.from(groupedByGroupId.values()).flatMap((rs) => rs.map((r) => r.id)),
  ];
  let stopCounts = new Map<string, number>();
  if (allEmittedRideIds.length > 0) {
    const { data: stopsAgg } = await supabase
      .from("ride_stops")
      .select("ride_id")
      .in("ride_id", allEmittedRideIds);
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

  const distanceFromDriver = (lat: number, lng: number) =>
    hasDriverPosition
      ? Number(
          haversineKm(
            { lat: driverLat, lng: driverLng },
            { lat, lng },
          ).toFixed(2),
        )
      : null;

  // Build the inbox entries. One entry per solo ride OR one per
  // carpool group. Carpool entries advertise both pickups + the
  // combined fare so the driver knows what they're signing up for.
  const soloEntries = soloRides.map((r) => ({
    kind: "solo" as const,
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
    distanceKmFromDriver: distanceFromDriver(r.pickup_lat, r.pickup_lng),
  }));

  const carpoolEntries = Array.from(groupedByGroupId.entries())
    .filter(([, rs]) => rs.length === 2) // only fully-formed pairs
    .map(([groupId, rs]) => {
      // Sort so primary (older) is first. Falls back to requested_at if
      // role wasn't set for any reason.
      const sorted = [...rs].sort((a, b) => {
        if (a.carpool_role === "primary") return -1;
        if (b.carpool_role === "primary") return 1;
        return (
          new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime()
        );
      });
      const [primary, secondary] = sorted;
      return {
        kind: "carpool" as const,
        id: primary.id, // primary's id used to wire up Accept
        groupId,
        rideIds: sorted.map((r) => r.id),
        primary: {
          rideId: primary.id,
          pickup: {
            name: primary.pickup_name,
            address: primary.pickup_address,
            parish: primary.pickup_parish,
            lat: primary.pickup_lat,
            lng: primary.pickup_lng,
          },
          dropoff: {
            name: primary.dropoff_name,
            address: primary.dropoff_address,
            parish: primary.dropoff_parish,
            lat: primary.dropoff_lat,
            lng: primary.dropoff_lng,
          },
          seats: primary.seats,
          fareJMD: primary.estimated_fare_jmd,
        },
        secondary: {
          rideId: secondary.id,
          pickup: {
            name: secondary.pickup_name,
            address: secondary.pickup_address,
            parish: secondary.pickup_parish,
            lat: secondary.pickup_lat,
            lng: secondary.pickup_lng,
          },
          dropoff: {
            name: secondary.dropoff_name,
            address: secondary.dropoff_address,
            parish: secondary.dropoff_parish,
            lat: secondary.dropoff_lat,
            lng: secondary.dropoff_lng,
          },
          seats: secondary.seats,
          fareJMD: secondary.estimated_fare_jmd,
        },
        // Combined view — useful for sorting + the UI summary.
        totalSeats: primary.seats + secondary.seats,
        combinedFareJMD: primary.estimated_fare_jmd + secondary.estimated_fare_jmd,
        // Use the primary's pickup as the "go to" coordinates for distance
        // calc — the driver heads there first.
        distanceKmFromDriver: distanceFromDriver(
          primary.pickup_lat,
          primary.pickup_lng,
        ),
        requestedAt: primary.requested_at,
      };
    });

  // Merge + sort by oldest requested-at across both types.
  const allEntries = [...soloEntries, ...carpoolEntries].sort(
    (a, b) =>
      new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime(),
  );

  return NextResponse.json({
    driver: { id: driver.id, activated: true },
    rides: allEntries,
  });
}
