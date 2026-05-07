import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/driver/rides/[id]/status
 *
 * Drives the ride status state-machine forward. Only the driver assigned
 * to the ride can call this, and only valid transitions are allowed:
 *
 *   accepted    → arrived
 *   arrived     → in_progress
 *   in_progress → completed
 *
 * Each transition stamps the matching timestamp column + writes a
 * ride_events row for the audit trail.
 *
 * Body: { action: "arrived" | "start" | "complete" }
 */

type Action = "arrived" | "start" | "complete";

const TRANSITIONS: Record<
  Action,
  { from: string; to: string; tsColumn: string; eventName: string }
> = {
  arrived: {
    from: "accepted",
    to: "arrived",
    tsColumn: "arrived_at",
    eventName: "arrived",
  },
  start: {
    from: "arrived",
    to: "in_progress",
    tsColumn: "started_at",
    eventName: "started",
  },
  complete: {
    from: "in_progress",
    to: "completed",
    tsColumn: "completed_at",
    eventName: "completed",
  },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action as Action | undefined;

  if (!action || !(action in TRANSITIONS)) {
    return NextResponse.json(
      { error: "action must be one of: arrived, start, complete" },
      { status: 400 },
    );
  }
  const transition = TRANSITIONS[action];

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

  // The caller must be the driver assigned to this ride.
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

  const now = new Date().toISOString();
  // Atomic state transition: only succeed if the ride is currently in the
  // `from` state AND assigned to this driver. Either constraint failing
  // returns 0 rows, which we surface as a 409.
  const { data: updated, error: updateError } = await supabase
    .from("rides")
    .update({
      status: transition.to,
      [transition.tsColumn]: now,
      // When completing, snapshot the final fare. Phase 2A future work:
      // recompute from actual GPS distance instead of using the estimate.
      ...(action === "complete"
        ? {
            final_fare_jmd: undefined, // see below
          }
        : {}),
    })
    .eq("id", id)
    .eq("driver_id", driver.id)
    .eq("status", transition.from)
    .select("id, estimated_fare_jmd")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      {
        error: `Ride is not in '${transition.from}' state, or you're not the assigned driver.`,
      },
      { status: 409 },
    );
  }

  // For "complete" we additionally backfill final_fare_jmd from the
  // estimate. Doing this in a second update keeps the conditional claim
  // above clean — the estimate is locked in at booking time so this is
  // safe.
  if (action === "complete") {
    await supabase
      .from("rides")
      .update({ final_fare_jmd: updated.estimated_fare_jmd })
      .eq("id", updated.id);
  }

  await supabase.from("ride_events").insert({
    ride_id: updated.id,
    event: transition.eventName,
    actor_role: "driver",
    actor_id: driver.external_id,
    metadata: { from: transition.from, to: transition.to },
  });

  return NextResponse.json({ ok: true, status: transition.to });
}
