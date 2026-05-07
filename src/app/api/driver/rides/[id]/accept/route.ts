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

  // 2. Look up the ride to find out if it's part of a carpool group.
  // Carpool rides have to be accepted together — the driver is
  // committing to TWO riders, not one.
  const { data: target } = await supabase
    .from("rides")
    .select("id, carpool_group_id")
    .eq("id", id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  // 3. Atomic claim. For solo rides we update the single row. For
  // carpool rides we update every row in the group with the same
  // conditions (`status='requested' AND driver_id IS NULL`), and roll
  // back if any update touched zero rows — that means another driver
  // raced us to one of the group's rides.
  const acceptedAt = new Date().toISOString();
  let claimedIds: string[];
  let claimedRiderIds: string[];

  if (target.carpool_group_id) {
    // Group-claim: scope by group_id and the same atomic conditions.
    // We load the group's expected size first so we can verify the
    // update affected ALL of them.
    const { data: groupRides } = await supabase
      .from("rides")
      .select("id")
      .eq("carpool_group_id", target.carpool_group_id);
    const expectedCount = groupRides?.length ?? 0;

    const { data: claimed, error: claimError } = await supabase
      .from("rides")
      .update({
        driver_id: driver.id,
        status: "accepted",
        accepted_at: acceptedAt,
      })
      .eq("carpool_group_id", target.carpool_group_id)
      .eq("status", "requested")
      .is("driver_id", null)
      .select("id, rider_id");

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }
    if (!claimed || claimed.length === 0) {
      return NextResponse.json(
        { error: "This carpool was just accepted by another driver." },
        { status: 409 },
      );
    }
    if (claimed.length !== expectedCount) {
      // Partial claim — another driver beat us to one of the group's
      // rides. Revert what we just claimed so we don't leave the group
      // half-assigned.
      await supabase
        .from("rides")
        .update({ driver_id: null, status: "requested", accepted_at: null })
        .in(
          "id",
          claimed.map((c) => c.id),
        );
      return NextResponse.json(
        { error: "Couldn't claim the whole carpool — another driver got part of it." },
        { status: 409 },
      );
    }

    // Update the group row to reflect the assigned driver.
    await supabase
      .from("carpool_groups")
      .update({ driver_id: driver.id, status: "dispatched" })
      .eq("id", target.carpool_group_id);

    claimedIds = claimed.map((c) => c.id);
    claimedRiderIds = claimed.map((c) => c.rider_id);
  } else {
    // Solo claim — original behaviour.
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
      return NextResponse.json(
        { error: "This ride was just accepted by another driver." },
        { status: 409 },
      );
    }
    claimedIds = [claimed.id];
    claimedRiderIds = [claimed.rider_id];
  }

  // 4. Audit events — one row per ride so the per-ride event log
  // stays a complete narrative for each rider's view.
  await supabase.from("ride_events").insert(
    claimedIds.map((rideId) => ({
      ride_id: rideId,
      event: "accepted",
      actor_role: "driver",
      actor_id: driver.external_id,
      metadata: {
        driverInternalId: driver.id,
        carpoolGroupId: target.carpool_group_id,
        groupSize: claimedIds.length,
      },
    })),
  );

  return NextResponse.json({
    ok: true,
    rideId: claimedIds[0],
    rideIds: claimedIds,
    riderIds: claimedRiderIds,
    carpool: target.carpool_group_id
      ? { groupId: target.carpool_group_id, size: claimedIds.length }
      : null,
  });
}
