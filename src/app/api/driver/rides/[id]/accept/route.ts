import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/driver/rides/[id]/accept
 *
 * An activated driver claims a `requested` ride. Atomic via a conditional
 * update (`status='requested' AND driver_id IS NULL`) so two drivers can't
 * both succeed in a race — whichever update touches 0 rows loses cleanly.
 */

export async function POST(
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

  // 1. Caller must be an activated, non-deactivated driver.
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, external_id, activated, deactivated_at")
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

  // 2. Atomic claim: only succeed if the ride is still open.
  const acceptedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("rides")
    .update({
      driver_id: driver.id,
      status: "accepted",
      accepted_at: acceptedAt,
    })
    .eq("id", id)
    .eq("status", "requested")
    .is("driver_id", null)
    .select("id, rider_id")
    .maybeSingle();

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }
  if (!claimed) {
    // Another driver got it (or the ride was cancelled).
    return NextResponse.json(
      { error: "This ride was just accepted by another driver." },
      { status: 409 },
    );
  }

  // 3. Audit event.
  await supabase.from("ride_events").insert({
    ride_id: claimed.id,
    event: "accepted",
    actor_role: "driver",
    actor_id: driver.external_id,
    metadata: { driverInternalId: driver.id },
  });

  return NextResponse.json({ ok: true, rideId: claimed.id });
}
