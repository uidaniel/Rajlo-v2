import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/rider/rides/[id]/rate
 *
 * The rider rates the driver who handled their trip.
 *
 * Body: { stars: 1..5, comment?: string }
 *
 * Rules:
 *   - Caller must be the rider on the ride
 *   - Ride must be `completed` (no rating un-finished trips)
 *   - The driver_id must be set (i.e. someone actually drove)
 *   - One rating per (ride, rater_role) — UNIQUE constraint at the DB
 *     level enforces this; we surface a friendly 409 if it trips
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
  // Comments are optional but capped — we don't want to use ratings as
  // a free-text dump.
  const rawComment = typeof body.comment === "string" ? body.comment.trim() : "";
  const comment = rawComment.length > 0 ? rawComment.slice(0, 500) : null;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  // Load the ride and verify the caller is the rider, the ride is
  // completed, and there's a driver to rate. We could enforce these
  // in RLS but the API path is clearer and gives better error messages.
  const { data: ride } = await supabase
    .from("rides")
    .select("id, rider_id, driver_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }
  if (ride.rider_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (ride.status !== "completed") {
    return NextResponse.json(
      { error: "You can only rate completed trips." },
      { status: 409 },
    );
  }
  if (!ride.driver_id) {
    return NextResponse.json(
      { error: "This ride doesn't have a driver to rate." },
      { status: 409 },
    );
  }

  // The drivers row links our internal driver_id to the auth.users.id
  // we need for the FK.
  const { data: driverRow } = await supabase
    .from("drivers")
    .select("user_id")
    .eq("id", ride.driver_id)
    .maybeSingle();
  if (!driverRow?.user_id) {
    return NextResponse.json(
      { error: "Driver record missing — can't store rating." },
      { status: 500 },
    );
  }

  const { error: insertError } = await supabase.from("ride_ratings").insert({
    ride_id: ride.id,
    rater_role: "rider",
    rater_id: user.id,
    rated_role: "driver",
    rated_id: driverRow.user_id,
    stars,
    comment,
  });

  if (insertError) {
    // Postgres unique-constraint violation = already rated.
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
