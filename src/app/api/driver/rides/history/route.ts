import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/driver/rides/history
 *
 * Returns the driver's past rides — completed + cancelled — most-recent
 * first. Used by /driver/history. Supports the same `?limit=` and
 * `?offset=` knobs as the rider variant.
 *
 * For each ride we include the rider's display name and the rating
 * the rider gave the driver (if any) — drivers care about feedback so
 * we surface it inline rather than making them dig.
 */

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

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const { data: rides, error } = await supabase
    .from("rides")
    .select(
      "id, status, rider_id, pickup_name, pickup_address, dropoff_name, dropoff_address, seats, estimated_fare_jmd, final_fare_jmd, requested_at, accepted_at, completed_at, cancelled_at, cancellation_reason, carpool_group_id",
    )
    .eq("driver_id", driver.id)
    .in("status", ["completed", "cancelled"])
    .order("requested_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = rides ?? [];

  // Bulk-fetch rider names + the rider's rating of THIS driver for
  // each ride. The rating filter is `rated_id = driver.user_id` so we
  // only see ratings about us, not ratings the rider may have given
  // to other drivers.
  const riderIds = Array.from(new Set(list.map((r) => r.rider_id)));
  const rideIds = list.map((r) => r.id);

  const [profilesRes, ratingsRes] = await Promise.all([
    riderIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", riderIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    rideIds.length > 0
      ? supabase
          .from("ride_ratings")
          .select("ride_id, stars")
          .eq("rated_id", driver.user_id)
          .eq("rated_role", "driver")
          .in("ride_id", rideIds)
      : Promise.resolve({ data: [] as { ride_id: string; stars: number }[] }),
  ]);

  // Bulk-aggregate the rider's average rating + count for every rider
  // on this page (single query, GROUP BY done in memory).
  const riderRatingAgg = await aggregateRatings(supabase, riderIds, "rider");

  const riderName = new Map<string, string>(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? "Rider"]),
  );
  const ratingByRide = new Map<string, number>(
    (ratingsRes.data ?? []).map((r) => [r.ride_id, r.stars]),
  );

  // Quick aggregate stat — total earnings across the visible page.
  // Useful for the page header without needing a separate endpoint.
  // (For the lifetime total the page would call a count-all endpoint;
  // skipping that for MVP.)
  const pageEarningsJMD = list.reduce(
    (sum, r) =>
      r.status === "completed"
        ? sum + (r.final_fare_jmd ?? r.estimated_fare_jmd ?? 0)
        : sum,
    0,
  );

  return NextResponse.json({
    rides: list.map((r) => {
      const riderAgg = riderRatingAgg.get(r.rider_id) ?? null;
      return {
        id: r.id,
        status: r.status,
        pickup: { name: r.pickup_name, address: r.pickup_address },
        dropoff: { name: r.dropoff_name, address: r.dropoff_address },
        seats: r.seats,
        fareJMD: r.final_fare_jmd ?? r.estimated_fare_jmd,
        requestedAt: r.requested_at,
        acceptedAt: r.accepted_at,
        endedAt: r.completed_at ?? r.cancelled_at,
        cancellationReason: r.cancellation_reason,
        riderName: riderName.get(r.rider_id) ?? "Rider",
        riderRating: riderAgg?.average ?? null,
        riderRatingCount: riderAgg?.count ?? 0,
        riderRatedStars: ratingByRide.get(r.id) ?? null,
        carpool: !!r.carpool_group_id,
      };
    }),
    pagination: {
      limit,
      offset,
      hasMore: list.length === limit,
    },
    pageEarningsJMD,
  });
}

/**
 * Aggregate ride_ratings into average stars + count grouped by
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
