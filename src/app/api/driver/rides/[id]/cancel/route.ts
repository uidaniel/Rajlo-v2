import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/driver/rides/[id]/cancel
 *
 * Driver cancels a ride they had accepted. Only allowed in `accepted` or
 * `arrived` — once the trip is `in_progress` the driver completes it
 * normally (they don't get to "cancel" mid-ride). After cancellation the
 * ride goes back into the open pool ONLY if it was rider-initiated; here
 * we simply mark it cancelled — the rider can re-request.
 *
 * Body: { reason?: string }
 */

const CANCELLABLE_BY_DRIVER = ["accepted", "arrived"];

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

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, external_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    .eq("driver_id", driver.id)
    .in("status", CANCELLABLE_BY_DRIVER)
    .select("id")
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
    actor_role: "driver",
    actor_id: driver.external_id,
    metadata: reason ? { reason } : null,
  });

  return NextResponse.json({ ok: true });
}
