import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/rider/rides/history
 *
 * Returns the rider's rides, most-recent first. Supports filtering:
 *   ?status=all       — completed + cancelled + in-flight (default)
 *   ?status=ongoing   — in-flight only (requested/accepted/arrived/in_progress)
 *   ?status=completed — completed only
 *   ?status=cancelled — cancelled only
 *
 * Pagination via `?limit=` (1..50, default 20) and `?offset=`.
 *
 * For each ride we include the assigned driver's display name + avg
 * rating, the rider's own rating (if they submitted one), and a
 * carpool flag. Used by the tabbed history page.
 */

const STATUS_GROUPS = {
  all: ["requested", "accepted", "arrived", "in_progress", "completed", "cancelled"],
  ongoing: ["requested", "accepted", "arrived", "in_progress"],
  completed: ["completed"],
  cancelled: ["cancelled"],
} as const;
type StatusFilter = keyof typeof STATUS_GROUPS;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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

  const url = new URL(request.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const statusParam = (url.searchParams.get("status") ?? "all") as StatusFilter;
  const statuses = STATUS_GROUPS[statusParam] ?? STATUS_GROUPS.all;

  const { data: rides, error } = await supabase
    .from("rides")
    .select(
      "id, status, driver_id, pickup_name, pickup_address, pickup_lat, pickup_lng, pickup_place_id, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, dropoff_place_id, seats, estimated_fare_jmd, final_fare_jmd, requested_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at, cancellation_reason, carpool_group_id",
    )
    .eq("rider_id", user.id)
    .in("status", statuses as unknown as string[])
    .order("requested_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = rides ?? [];

  // Bulk-fetch the bits we need to enrich each row: driver names + the
  // rider's own ratings. Doing one query each instead of N+1 round-trips.
  const driverInternalIds = Array.from(
    new Set(list.map((r) => r.driver_id).filter((x): x is string => !!x)),
  );
  const rideIds = list.map((r) => r.id);

  const [driversRes, ratingsRes] = await Promise.all([
    driverInternalIds.length > 0
      ? supabase
          .from("drivers")
          .select("id, first_name, last_name, user_id")
          .in("id", driverInternalIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            first_name: string | null;
            last_name: string | null;
            user_id: string;
          }[],
        }),
    rideIds.length > 0
      ? supabase
          .from("ride_ratings")
          .select("ride_id, stars")
          .eq("rater_id", user.id)
          .in("ride_id", rideIds)
      : Promise.resolve({ data: [] as { ride_id: string; stars: number }[] }),
  ]);

  const driverByInternalId = new Map(
    (driversRes.data ?? []).map((d) => [d.id, d]),
  );

  // Bulk-aggregate the average rating + count for every driver who
  // appears in this page. Single query, GROUP BY-equivalent done in
  // memory. Avoids N round-trips to getAverageRating().
  const driverUserIds = (driversRes.data ?? [])
    .map((d) => d.user_id)
    .filter((x): x is string => !!x);
  const driverRatingAgg = await aggregateRatings(
    supabase,
    driverUserIds,
    "driver",
  );

  const ratingByRide = new Map<string, number>(
    (ratingsRes.data ?? []).map((r) => [r.ride_id, r.stars]),
  );

  // Pull route taxi hails too. The history page shows everything the
  // rider has booked — Mode A (rides) and Mode B (route_hails) — with
  // a small badge so they can tell them apart at a glance.
  //
  // We over-fetch (limit + offset of EACH source) then merge + sort
  // by requestedAt descending and slice to the page window. Cheap at
  // rider scale (no rider has thousands of hails) and avoids a fragile
  // "two-cursor" pagination scheme.
  const hailStatusFilter = (() => {
    if (statusParam === "ongoing") return ["requested", "accepted", "picked_up"];
    if (statusParam === "completed") return ["completed"];
    if (statusParam === "cancelled") return ["cancelled", "no_show"];
    return [
      "requested",
      "accepted",
      "picked_up",
      "completed",
      "cancelled",
      "no_show",
    ];
  })();

  const { data: hails } = await supabase
    .from("route_hails")
    .select(
      "id, status, route_id, session_id, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, fare_jmd, requested_at, accepted_at, picked_up_at, completed_at, cancelled_at, cancellation_reason, concession",
    )
    .eq("rider_id", user.id)
    .in("status", hailStatusFilter)
    .order("requested_at", { ascending: false })
    .limit(offset + limit);

  // Hydrate hail driver names via the session → driver chain.
  const sessionIds = Array.from(
    new Set((hails ?? []).map((h) => h.session_id).filter((x): x is string => !!x)),
  );
  const sessionDriverByHail = new Map<string, string | null>();
  if (sessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from("driver_sessions")
      .select("id, driver_id")
      .in("id", sessionIds);
    const driverIds = Array.from(
      new Set((sessions ?? []).map((s) => s.driver_id)),
    );
    const { data: hailDrivers } = await supabase
      .from("drivers")
      .select("id, first_name, last_name")
      .in("id", driverIds);
    const driverNameById = new Map(
      (hailDrivers ?? []).map((d) => [
        d.id,
        [d.first_name, d.last_name].filter(Boolean).join(" ") || "Driver",
      ]),
    );
    const driverIdBySession = new Map(
      (sessions ?? []).map((s) => [s.id, s.driver_id]),
    );
    for (const h of hails ?? []) {
      if (!h.session_id) continue;
      const driverId = driverIdBySession.get(h.session_id);
      if (driverId) {
        sessionDriverByHail.set(h.id, driverNameById.get(driverId) ?? null);
      }
    }
  }

  // Map hail status into the ride-shaped status the page already
  // knows how to render. `picked_up` becomes `in_progress` (rider in
  // the car), `no_show` becomes `cancelled` with a reason.
  const hailStatusToRide = (s: string): RideShapedStatus => {
    if (s === "picked_up") return "in_progress";
    if (s === "no_show") return "cancelled";
    return s as RideShapedStatus;
  };

  type Row = ReturnType<typeof shapePrivate> | ReturnType<typeof shapeHail>;

  function shapePrivate(r: (typeof list)[number]) {
    const d = r.driver_id
      ? driverByInternalId.get(r.driver_id) ?? null
      : null;
    const driverAgg = d?.user_id
      ? driverRatingAgg.get(d.user_id) ?? null
      : null;
    return {
      id: r.id,
      kind: "private" as const,
      status: r.status as RideShapedStatus,
      pickup: {
        name: r.pickup_name,
        address: r.pickup_address,
        lat: r.pickup_lat,
        lng: r.pickup_lng,
        placeId: r.pickup_place_id,
      },
      dropoff: {
        name: r.dropoff_name,
        address: r.dropoff_address,
        lat: r.dropoff_lat,
        lng: r.dropoff_lng,
        placeId: r.dropoff_place_id,
      },
      seats: r.seats,
      fareJMD: r.final_fare_jmd ?? r.estimated_fare_jmd,
      requestedAt: r.requested_at,
      acceptedAt: r.accepted_at,
      arrivedAt: r.arrived_at,
      startedAt: r.started_at,
      endedAt: r.completed_at ?? r.cancelled_at,
      cancellationReason: r.cancellation_reason,
      driverName: d
        ? [d.first_name, d.last_name].filter(Boolean).join(" ") || "Driver"
        : null,
      driverRating: driverAgg?.average ?? null,
      driverRatingCount: driverAgg?.count ?? 0,
      myRatingStars: ratingByRide.get(r.id) ?? null,
      carpool: !!r.carpool_group_id,
    };
  }

  function shapeHail(h: NonNullable<typeof hails>[number]) {
    return {
      id: h.id,
      kind: "route_taxi" as const,
      status: hailStatusToRide(h.status),
      pickup: {
        name: h.pickup_name,
        address: h.pickup_name,
        lat: h.pickup_lat,
        lng: h.pickup_lng,
        placeId: null,
      },
      dropoff: {
        name: h.dropoff_name,
        address: h.dropoff_name,
        lat: h.dropoff_lat,
        lng: h.dropoff_lng,
        placeId: null,
      },
      seats: 1,
      fareJMD: h.fare_jmd,
      requestedAt: h.requested_at,
      acceptedAt: h.accepted_at,
      arrivedAt: null,
      startedAt: h.picked_up_at,
      endedAt: h.completed_at ?? h.cancelled_at,
      cancellationReason:
        h.status === "no_show"
          ? "No-show — driver couldn't catch you in time."
          : h.cancellation_reason,
      driverName: sessionDriverByHail.get(h.id) ?? null,
      driverRating: null,
      driverRatingCount: 0,
      myRatingStars: null,
      carpool: false,
      concession: h.concession,
    };
  }

  const merged: Row[] = [
    ...list.map(shapePrivate),
    ...(hails ?? []).map(shapeHail),
  ];
  merged.sort(
    (a, b) =>
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  );
  const page = merged.slice(offset, offset + limit);

  return NextResponse.json({
    rides: page,
    pagination: {
      limit,
      offset,
      hasMore: merged.length > offset + limit,
    },
  });
}

type RideShapedStatus =
  | "requested"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

/**
 * Aggregate ride_ratings into average stars + count, grouped by
 * rated_id. Bulk-fetches all relevant rating rows in one query and
 * does the GROUP BY in JS — way cheaper than N getAverageRating()
 * calls when the history page renders 20+ rows.
 */
async function aggregateRatings(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  ratedUserIds: string[],
  ratedRole: "driver" | "rider",
): Promise<Map<string, { average: number; count: number }>> {
  const out = new Map<string, { average: number; count: number }>();
  if (!supabase || ratedUserIds.length === 0) return out;
  const { data } = await supabase
    .from("ride_ratings")
    .select("rated_id, stars")
    .eq("rated_role", ratedRole)
    .in("rated_id", ratedUserIds);
  if (!data) return out;
  const sums = new Map<string, { sum: number; count: number }>();
  for (const r of data) {
    const acc = sums.get(r.rated_id) ?? { sum: 0, count: 0 };
    acc.sum += r.stars ?? 0;
    acc.count += 1;
    sums.set(r.rated_id, acc);
  }
  for (const [id, { sum, count }] of sums) {
    out.set(id, {
      average: Math.round((sum / count) * 10) / 10,
      count,
    });
  }
  return out;
}
