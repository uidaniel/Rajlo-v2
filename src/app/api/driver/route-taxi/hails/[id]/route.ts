import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { creditWallet, debitWallet } from "@/lib/wallet";
import { splitFare } from "@/lib/fare-engine";
import { notifyRider } from "@/lib/notify";

/**
 * PATCH /api/driver/route-taxi/hails/[id]
 *
 * Drives the route-hail state machine from the driver side. Body shape:
 *   { to: 'accepted' | 'picked_up' | 'completed' | 'cancelled',
 *     reason?: string }
 *
 * Allowed transitions:
 *   requested → accepted    (driver attaches their session, blocks a seat)
 *   accepted  → picked_up   (rider boarded)
 *   picked_up → completed   (rider dropped off; wallets settle here)
 *   accepted  → cancelled   (driver bails before pickup; seat freed)
 *   picked_up → cancelled   (rare — driver can't deliver; seat freed)
 *
 * Settlement (only at `completed`):
 *   1. Debit rider wallet `fare_jmd` (`ride_charge` kind, refs hail in metadata).
 *   2. Credit driver wallet `driver_earnings_jmd` from `splitFare(fare_jmd)`.
 *   3. Stamp `commission_jmd`, `driver_earnings_jmd`, `*_transaction_id`
 *      on the hail row so reconciliation is one query.
 *
 * If the rider debit fails (insufficient balance — shouldn't happen
 * because we gate at hail time, but the balance can drop in the
 * meantime), we leave the hail in a `picked_up` state and return 402
 * so the driver UI can prompt the rider to top up.
 */

type TransitionBody = {
  to?: "accepted" | "picked_up" | "completed" | "cancelled";
  reason?: string;
};

const ALLOWED: Record<string, string[]> = {
  requested: ["accepted"],
  accepted: ["picked_up", "cancelled"],
  picked_up: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: hailId } = await ctx.params;
  if (!hailId) {
    return NextResponse.json({ error: "missing hail id" }, { status: 400 });
  }

  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: TransitionBody;
  try {
    body = (await request.json()) as TransitionBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const target = body.to;
  if (!target || !["accepted", "picked_up", "completed", "cancelled"].includes(target)) {
    return NextResponse.json(
      { error: "to must be one of accepted | picked_up | completed | cancelled" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  // Resolve driver row.
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, first_name, last_name, plate_number")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "Driver record not found" }, { status: 404 });
  }

  // Load the hail + verify it's on the driver's route (for accept) or
  // their existing session (for the later transitions).
  const { data: hail, error: hailError } = await supabase
    .from("route_hails")
    .select(
      "id, rider_id, route_id, session_id, status, fare_jmd, distance_km, pickup_name, dropoff_name",
    )
    .eq("id", hailId)
    .maybeSingle();

  if (hailError || !hail) {
    return NextResponse.json({ error: "hail not found" }, { status: 404 });
  }

  // Validate the transition is legal from the current status.
  if (!ALLOWED[hail.status]?.includes(target)) {
    return NextResponse.json(
      {
        error: `Cannot transition from ${hail.status} to ${target}`,
      },
      { status: 409 },
    );
  }

  // Driver's currently-active session — needed for accept (we attach
  // the hail to it) and for the post-accept transitions (must own the hail).
  const { data: session } = await supabase
    .from("driver_sessions")
    .select("id, route_id, vehicle_capacity, seats_taken, status")
    .eq("driver_id", driver.id)
    .eq("status", "active")
    .maybeSingle();

  if (target === "accepted") {
    if (!session) {
      return NextResponse.json(
        { error: "Start a session before accepting hails." },
        { status: 409 },
      );
    }
    if (session.route_id !== hail.route_id) {
      return NextResponse.json(
        { error: "Hail is on a different route than your session." },
        { status: 409 },
      );
    }
    if (session.seats_taken >= session.vehicle_capacity) {
      return NextResponse.json(
        { error: "Vehicle is full — end the trip or drop someone off first." },
        { status: 409 },
      );
    }
    if (hail.session_id) {
      return NextResponse.json(
        { error: "Another driver already accepted this hail." },
        { status: 409 },
      );
    }

    const { error: acceptError } = await supabase
      .from("route_hails")
      .update({
        session_id: session.id,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", hail.id)
      .eq("status", "requested") // optimistic concurrency: another driver may have grabbed it
      .is("session_id", null);

    if (acceptError) {
      return NextResponse.json({ error: acceptError.message }, { status: 500 });
    }

    // Best-effort rider notification.
    void notifyRider(supabase, {
      riderId: hail.rider_id,
      kind: "trip",
      title: "Driver on the way",
      body: `${driver.first_name ?? "Your driver"} accepted your route taxi. ${
        driver.plate_number ? `Plate ${driver.plate_number}.` : ""
      }`,
      href: "/rider/route-taxi",
      cta: "View hail",
      pushTag: `route-hail-${hail.id}`,
      pushRenotify: true,
    }).catch(() => null);

    return NextResponse.json({ ok: true, status: "accepted" });
  }

  // Past-accept transitions: must own the hail via current session.
  if (!session || hail.session_id !== session.id) {
    return NextResponse.json(
      { error: "You don't own this hail." },
      { status: 403 },
    );
  }

  if (target === "picked_up") {
    const { error: pickupError } = await supabase
      .from("route_hails")
      .update({
        status: "picked_up",
        picked_up_at: new Date().toISOString(),
      })
      .eq("id", hail.id)
      .eq("status", "accepted");

    if (pickupError) {
      return NextResponse.json({ error: pickupError.message }, { status: 500 });
    }

    void notifyRider(supabase, {
      riderId: hail.rider_id,
      kind: "trip",
      title: "Trip in progress",
      body: `Onboard with ${driver.first_name ?? "your driver"} — heading to ${hail.dropoff_name}.`,
      href: "/rider/route-taxi",
      cta: "View trip",
      pushTag: `route-hail-${hail.id}`,
      pushRenotify: false,
    }).catch(() => null);

    return NextResponse.json({ ok: true, status: "picked_up" });
  }

  if (target === "completed") {
    const fareJmd = hail.fare_jmd as number;
    const { driverEarningsJmd, commissionJmd } = splitFare(fareJmd);

    // 1. Debit the rider. Cashless rule: if their balance can't cover
    //    it, we don't fudge — we tell the driver to prompt the rider
    //    to top up before they get out of the car.
    const debit = await debitWallet(supabase, hail.rider_id, fareJmd, "ride_charge", {
      description: `Route taxi · ${hail.pickup_name} → ${hail.dropoff_name}`,
      metadata: { route_hail_id: hail.id, kind: "route_taxi" },
    });
    if (!debit.ok) {
      return NextResponse.json(
        {
          error: debit.insufficientFunds ? "rider_insufficient_balance" : debit.error,
          message: debit.insufficientFunds
            ? "Rider's wallet can't cover the fare. Ask them to top up before they exit."
            : "Wallet debit failed.",
        },
        { status: debit.insufficientFunds ? 402 : 500 },
      );
    }

    // 2. Credit the driver their earnings (fare − commission).
    const credit = await creditWallet(
      supabase,
      user.id,
      driverEarningsJmd,
      "ride_earning",
      {
        description: `Route taxi · ${hail.pickup_name} → ${hail.dropoff_name}`,
        metadata: {
          route_hail_id: hail.id,
          kind: "route_taxi",
          gross_fare_jmd: fareJmd,
          commission_jmd: commissionJmd,
        },
      },
    );
    if (!credit.ok) {
      // The rider was already charged. We log the discrepancy on the
      // hail so admin can manually reconcile. Don't return 500 — the
      // rider's trip really is complete.
      console.error(
        `route-taxi settlement: rider charged but driver credit failed (hail ${hail.id}): ${credit.error}`,
      );
    }

    // 3. Stamp the hail with the settled amounts.
    const { error: completeError } = await supabase
      .from("route_hails")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        commission_jmd: commissionJmd,
        driver_earnings_jmd: driverEarningsJmd,
        charged_transaction_id: debit.transactionId,
        driver_credit_transaction_id: credit.ok ? credit.transactionId : null,
      })
      .eq("id", hail.id);

    if (completeError) {
      return NextResponse.json(
        { error: completeError.message },
        { status: 500 },
      );
    }

    void notifyRider(supabase, {
      riderId: hail.rider_id,
      kind: "trip",
      title: "Trip complete",
      body: `JMD $${fareJmd} debited from your wallet. Tap to rate.`,
      href: "/rider/route-taxi",
      cta: "Rate driver",
      pushTag: `route-hail-${hail.id}`,
      pushRenotify: true,
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      status: "completed",
      fareJmd,
      driverEarningsJmd,
      commissionJmd,
      riderBalanceAfter: debit.balanceAfter,
    });
  }

  if (target === "cancelled") {
    const { error: cancelError } = await supabase
      .from("route_hails")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: body.reason ?? "Driver cancelled",
      })
      .eq("id", hail.id)
      .in("status", ["accepted", "picked_up"]);

    if (cancelError) {
      return NextResponse.json({ error: cancelError.message }, { status: 500 });
    }

    void notifyRider(supabase, {
      riderId: hail.rider_id,
      kind: "trip",
      title: "Driver cancelled",
      body:
        body.reason ??
        "Your driver had to cancel — hail another car when you're ready.",
      href: "/rider/route-taxi",
      cta: "Re-hail",
      pushTag: `route-hail-${hail.id}`,
      pushRenotify: true,
    }).catch(() => null);

    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return NextResponse.json({ error: "unhandled transition" }, { status: 500 });
}
