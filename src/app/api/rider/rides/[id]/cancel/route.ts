import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { sendTripCancelledEmail } from "@/lib/email-templates";
import { notifyDriver } from "@/lib/notify";

/**
 * POST /api/rider/rides/[id]/cancel
 *
 * Rider cancels their own ride. Allowed only while the trip hasn't
 * actually started — once the driver has marked it `in_progress` the
 * rider can't unilaterally cancel from the app (they'd contact support
 * for a refund/dispute path which is a Phase-3 concern).
 *
 * Body: { reason?: string }
 */

const CANCELLABLE_BY_RIDER = ["requested", "accepted", "arrived"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = body.reason?.trim() || null;

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

  const now = new Date().toISOString();
  const { data: cancelled, error } = await supabase
    .from("rides")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancellation_reason: reason,
    })
    .eq("id", id)
    .eq("rider_id", user.id)
    .in("status", CANCELLABLE_BY_RIDER)
    .select("id, pickup_name, dropoff_name, driver_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!cancelled) {
    return NextResponse.json(
      {
        error:
          "This ride can't be cancelled — it may already be in progress, completed, or cancelled.",
      },
      { status: 409 },
    );
  }

  await supabase.from("ride_events").insert({
    ride_id: cancelled.id,
    event: "cancelled",
    actor_role: "rider",
    actor_id: user.id,
    metadata: reason ? { reason } : null,
  });

  // Best-effort confirmation email — rider just cancelled their own
  // ride, so we already have their auth user object in scope.
  if (user.email) {
    const { data: profile } = await auth
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    void sendTripCancelledEmail(user.email, {
      riderFirstName: profile?.full_name ?? null,
      rideId: cancelled.id,
      pickup: cancelled.pickup_name,
      dropoff: cancelled.dropoff_name,
      cancelledBy: "rider",
      reason,
    }).catch(() => null);
  }

  // If the trip had been accepted, push the assigned driver so they
  // know to free up and stop heading to the pickup.
  if (cancelled.driver_id) {
    void (async () => {
      try {
        const { data: d } = await supabase
          .from("drivers")
          .select("user_id")
          .eq("id", cancelled.driver_id)
          .maybeSingle();
        if (!d?.user_id) return;
        await notifyDriver(supabase, {
          driverUserId: d.user_id,
          kind: "trip_update",
          title: "Rider cancelled the trip",
          body: `${cancelled.pickup_name} → ${cancelled.dropoff_name}. You can stand down — request is closed.`,
          href: "/driver",
          cta: "Back to inbox",
          pushTag: `ride-${cancelled.id}-status`,
          pushRenotify: true,
        });
      } catch {
        /* best-effort */
      }
    })();
  }

  return NextResponse.json({ ok: true });
}
