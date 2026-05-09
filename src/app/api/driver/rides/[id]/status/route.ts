import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import {
  sendTripCompletedEmail,
  sendDriverTripCompletedEmail,
} from "@/lib/email-templates";
import { notifyRider } from "@/lib/notify";
import { resolveDriverEmail } from "@/lib/driver-email-resolver";
import { creditWallet, debitWallet } from "@/lib/wallet";

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

    // Money movement on completion: debit each rider's wallet for
    // their final fare and credit the driver's wallet by the same
    // amount. Today the driver gets 100% of the fare — when a
    // platform commission lands later, just credit the driver
    // (fare - commission) and credit a Rajlo "treasury" wallet for
    // the commission cut.
    //
    // Best-effort: a wallet failure here doesn't roll back the
    // ride completion (the ride is physically done — the driver
    // already drove it). Failures get surfaced through the
    // wallet's transaction history so admin can reconcile via
    // /admin/wallets/[userId]/adjust.
    void (async () => {
      try {
        const { data: completedRides } = await supabase
          .from("rides")
          .select("id, rider_id, final_fare_jmd, estimated_fare_jmd, pickup_name, dropoff_name")
          .in(
            "id",
            updated.map((u) => u.id),
          );
        for (const ride of (completedRides ?? []) as Array<{
          id: string;
          rider_id: string;
          final_fare_jmd: number | null;
          estimated_fare_jmd: number;
          pickup_name: string;
          dropoff_name: string;
        }>) {
          const fare = ride.final_fare_jmd ?? ride.estimated_fare_jmd;
          if (!fare || fare <= 0) continue;
          const description = `Ride · ${ride.pickup_name} → ${ride.dropoff_name}`;

          // Debit the rider. If they're short, the trigger raises
          // and we record the failure as a metadata note on the
          // ride; admin sweeps these via the wallets page.
          const debit = await debitWallet(
            supabase,
            ride.rider_id,
            fare,
            "ride_charge",
            { rideId: ride.id, description },
          );
          if (!debit.ok) {
            console.error(
              `Couldn't debit rider ${ride.rider_id} ${fare} JMD for ride ${ride.id}:`,
              debit.error,
            );
            continue;
          }

          // Credit the driver. user.id is the driver's auth id.
          const credit = await creditWallet(
            supabase,
            user.id,
            fare,
            "ride_earning",
            { rideId: ride.id, description },
          );
          if (!credit.ok) {
            console.error(
              `Couldn't credit driver ${user.id} ${fare} JMD for ride ${ride.id}:`,
              credit.error,
            );
          }
        }
      } catch (err) {
        console.error("Wallet movement on ride completion failed:", err);
      }
    })();

    // Best-effort receipt email per affected rider. We pull each
    // ride's full record + driver name so the receipt has every detail.
    void (async () => {
      try {
        const ids = updated.map((u) => u.id);
        const [{ data: rideRows }, { data: driverFull }] = await Promise.all([
          supabase
            .from("rides")
            .select(
              "id, rider_id, pickup_name, dropoff_name, estimated_distance_km, started_at, completed_at, final_fare_jmd",
            )
            .in("id", ids),
          supabase
            .from("drivers")
            .select("first_name, last_name, email, user_id")
            .eq("id", driver.id)
            .maybeSingle(),
        ]);
        if (!rideRows) return;

        const driverName =
          [driverFull?.first_name, driverFull?.last_name]
            .filter(Boolean)
            .join(" ") || "Your driver";

        const riderIds = Array.from(new Set(rideRows.map((r) => r.rider_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", riderIds);
        const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
        const userLookups = await Promise.all(
          riderIds.map((id) =>
            supabase.auth.admin.getUserById(id).then((r) => ({
              id,
              email: r.data.user?.email ?? null,
            })),
          ),
        );
        const emailMap = new Map(userLookups.map((u) => [u.id, u.email]));

        // Resolve driver-side email once for the earnings receipts.
        const driverEmail = driverFull
          ? await resolveDriverEmail(supabase, driverFull)
          : null;

        await Promise.all(
          rideRows.flatMap((row) => {
            const email = emailMap.get(row.rider_id);
            const durationMinutes =
              row.started_at && row.completed_at
                ? Math.max(
                    1,
                    Math.round(
                      (new Date(row.completed_at).getTime() -
                        new Date(row.started_at).getTime()) /
                        60_000,
                    ),
                  )
                : null;
            const fare = `JMD ${Math.round(row.final_fare_jmd ?? 0).toLocaleString("en-JM")}`;
            const riderFullName =
              profileMap.get(row.rider_id)?.full_name ?? null;
            const tasks: Array<Promise<unknown>> = [
              notifyRider(supabase, {
                riderId: row.rider_id,
                kind: "trip",
                title: "Trip complete · rate your driver",
                body: `${row.dropoff_name} · ${fare}. Tap to rate ${driverName.split(" ")[0]}.`,
                href: `/rider/history/${row.id}?rate=1`,
                cta: "Rate this trip",
                pushTag: `ride-${row.id}-status`,
              }),
            ];
            if (email) {
              tasks.push(
                sendTripCompletedEmail(email, {
                  riderFirstName: riderFullName,
                  rideId: row.id,
                  pickup: row.pickup_name,
                  dropoff: row.dropoff_name,
                  fareJMD: row.final_fare_jmd,
                  distanceKm: row.estimated_distance_km,
                  durationMinutes,
                  driverName,
                  completedAt: row.completed_at,
                }).catch(() => null),
              );
            }
            // Driver earnings receipt — one per completed ride
            // (carpool: one earnings email per leg).
            if (driverEmail) {
              tasks.push(
                sendDriverTripCompletedEmail(driverEmail, {
                  driverName,
                  rideId: row.id,
                  pickup: row.pickup_name,
                  dropoff: row.dropoff_name,
                  fareJMD: row.final_fare_jmd,
                  distanceKm: row.estimated_distance_km,
                  durationMinutes,
                  riderFirstName: riderFullName?.split(" ")[0] ?? null,
                  completedAt: row.completed_at,
                }).catch(() => null),
              );
            }
            return tasks;
          }),
        );
      } catch {
        /* best-effort */
      }
    })();
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

  // In-app inbox + push for arrival / start. Trip completion has its
  // own bespoke push below alongside the receipt email.
  if (action === "arrived" || action === "start") {
    void (async () => {
      try {
        const ids = updated.map((u) => u.id);
        const { data: rideRows } = await supabase
          .from("rides")
          .select("id, rider_id, dropoff_name")
          .in("id", ids);
        if (!rideRows) return;
        await Promise.all(
          rideRows.map((row) =>
            notifyRider(supabase, {
              riderId: row.rider_id,
              kind: "trip",
              title:
                action === "arrived"
                  ? "Your driver is here!"
                  : "Trip started",
              body:
                action === "arrived"
                  ? "Confirm the plate before you step in. Let's go!"
                  : `On the way to ${row.dropoff_name}.`,
              href: `/rider/live-trip?id=${row.id}`,
              cta:
                action === "arrived" ? "Open live trip" : "Track on map",
              pushTag: `ride-${row.id}-status`,
              pushRenotify: action === "arrived",
            }),
          ),
        );
      } catch {
        /* best-effort */
      }
    })();
  }

  return NextResponse.json({
    ok: true,
    status: transition.to,
    affectedRideIds: updated.map((r) => r.id),
  });
}
