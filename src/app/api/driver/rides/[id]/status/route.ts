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

  // Look up the ride first so we know whether it's part of a carpool.
  // For carpool rides every status transition affects ALL rides in the
  // group together — when the driver taps "I've arrived" they're at
  // the (single) primary pickup and both rides move from accepted to
  // arrived; "Start trip" flips both to in_progress; "Complete"
  // completes both at once. The MVP doesn't support per-rider
  // sub-states (e.g. picked-up-A-but-still-driving-to-B); that's a
  // future refinement.
  const { data: target } = await supabase
    .from("rides")
    .select("id, carpool_group_id, driver_id")
    .eq("id", id)
    .maybeSingle();
  if (!target || target.driver_id !== driver.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  // Atomic state transition: only succeed if all targeted rides are
  // currently in the `from` state AND assigned to this driver.
  let updateQuery = supabase
    .from("rides")
    .update({
      status: transition.to,
      [transition.tsColumn]: now,
    })
    .eq("driver_id", driver.id)
    .eq("status", transition.from);

  if (target.carpool_group_id) {
    updateQuery = updateQuery.eq("carpool_group_id", target.carpool_group_id);
  } else {
    updateQuery = updateQuery.eq("id", id);
  }

  const { data: updated, error: updateError } = await updateQuery.select(
    "id, estimated_fare_jmd",
  );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      {
        error: `Ride is not in '${transition.from}' state, or you're not the assigned driver.`,
      },
      { status: 409 },
    );
  }

  // For "complete" we additionally backfill final_fare_jmd from each
  // ride's own estimate. We do it per-row so each rider's row gets
  // their own fare snapshot rather than a copy of the group's.
  if (action === "complete") {
    await Promise.all(
      updated.map((row) =>
        supabase
          .from("rides")
          .update({ final_fare_jmd: row.estimated_fare_jmd })
          .eq("id", row.id),
      ),
    );
    // Mark the carpool group itself as completed so the group row
    // tells a coherent story for any future analytics.
    if (target.carpool_group_id) {
      await supabase
        .from("carpool_groups")
        .update({ status: "completed" })
        .eq("id", target.carpool_group_id);
    }
  }

  // One audit row per ride affected — the per-ride event log stays a
  // complete narrative for each rider's view.
  await supabase.from("ride_events").insert(
    updated.map((row) => ({
      ride_id: row.id,
      event: transition.eventName,
      actor_role: "driver",
      actor_id: driver.external_id,
      metadata: {
        from: transition.from,
        to: transition.to,
        carpoolGroupId: target.carpool_group_id,
      },
    })),
  );

  return NextResponse.json({
    ok: true,
    status: transition.to,
    affectedRideIds: updated.map((r) => r.id),
  });
}
