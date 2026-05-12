import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { fetchPlannedRoute } from "@/lib/directions";

/**
 * GET /api/rider/rides/[id]/route-plan
 *
 * Returns the planned route polyline (Google Directions encoded) for
 * the rider's active trip. Lazy fetch — if the rides row doesn't have
 * a polyline yet, we call Directions once, store the result, and
 * return it. Subsequent calls return the cached version with no
 * external API hit.
 *
 * Only the rider on the trip can call this — RLS plus a manual rider_id
 * check below. Officers / admins get the same polyline via their own
 * admin-side endpoint (not added in this pass, but trivially derived
 * from the same DB column).
 *
 * Response:
 *   200 → { polyline: string, distanceM: number, durationS: number }
 *   404 → ride not found / not assigned to this rider
 *   503 → Directions API unavailable (rider's client should disable
 *          off-route detection on this response, not retry indefinitely)
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

  const { data: ride } = await supabase
    .from("rides")
    .select(
      "id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, planned_polyline, planned_distance_m, planned_duration_s",
    )
    .eq("id", id)
    .maybeSingle();
  if (!ride || ride.rider_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Cache hit — return the stored polyline.
  if (
    ride.planned_polyline &&
    typeof ride.planned_distance_m === "number" &&
    typeof ride.planned_duration_s === "number"
  ) {
    return NextResponse.json({
      polyline: ride.planned_polyline,
      distanceM: ride.planned_distance_m,
      durationS: ride.planned_duration_s,
    });
  }

  // Cache miss — call Directions once, store the result.
  const planned = await fetchPlannedRoute(
    { lat: ride.pickup_lat as number, lng: ride.pickup_lng as number },
    { lat: ride.dropoff_lat as number, lng: ride.dropoff_lng as number },
  );
  if (!planned) {
    return NextResponse.json(
      { error: "directions_unavailable" },
      { status: 503 },
    );
  }

  await supabase
    .from("rides")
    .update({
      planned_polyline: planned.polyline,
      planned_distance_m: planned.distanceM,
      planned_duration_s: planned.durationS,
      planned_route_fetched_at: new Date().toISOString(),
    })
    .eq("id", ride.id);

  return NextResponse.json({
    polyline: planned.polyline,
    distanceM: planned.distanceM,
    durationS: planned.durationS,
  });
}
