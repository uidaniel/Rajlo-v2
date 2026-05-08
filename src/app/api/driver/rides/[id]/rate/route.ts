import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/driver/rides/[id]/rate
 *
 * The driver rates the rider they just transported.
 *
 * Body: { stars: 1..5, comment?: string }
 *
 * Mirror of the rider-side endpoint with role flipped:
 *   - Caller must be the driver assigned to the ride
 *   - Ride must be `completed`
 *   - One rating per (ride, driver) — UNIQUE on (ride_id, rater_role)
 *     enforces this at the DB level
 *
 * For carpool trips, this rates the rider attached to *this specific
 * ride row*. The driver hits the endpoint twice (once per ride) to
 * rate both passengers — same pattern as completing each ride
 * individually.
 */

type RateBody = {
  stars?: unknown;
  comment?: unknown;
};

export async function POST(
  request: Request,
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

  const body = (await request.json().catch(() => ({}))) as RateBody;
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json(
      { error: "stars must be an integer between 1 and 5" },
      { status: 400 },
    );
  }
  const rawComment = typeof body.comment === "string" ? body.comment.trim() : "";
  const comment = rawComment.length > 0 ? rawComment.slice(0, 500) : null;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  // Caller must be a driver row.
  const { data: driverRow } = await supabase
    .from("drivers")
    .select("id, user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driverRow) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Ride must exist, be completed, and assigned to this driver.
  const { data: ride } = await supabase
    .from("rides")
    .select("id, rider_id, driver_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }
  if (ride.driver_id !== driverRow.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (ride.status !== "completed") {
    return NextResponse.json(
      { error: "You can only rate completed trips." },
      { status: 409 },
    );
  }

  const { error: insertError } = await supabase.from("ride_ratings").insert({
    ride_id: ride.id,
    rater_role: "driver",
    rater_id: user.id,
    rated_role: "rider",
    rated_id: ride.rider_id,
    stars,
    comment,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You've already rated this trip." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
