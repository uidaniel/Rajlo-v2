import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

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
    actor_role: "rider",
    actor_id: user.id,
    metadata: reason ? { reason } : null,
  });

  return NextResponse.json({ ok: true });
}
