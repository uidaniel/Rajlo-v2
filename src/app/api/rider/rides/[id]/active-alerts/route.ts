import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/rider/rides/[id]/active-alerts
 *
 * Lists the rider's still-actionable safety alerts on a specific ride
 * (status in 'open' / 'acknowledged'). Used by the live-trip page to
 * decide whether to show the persistent "Safety chat" pill — the
 * floating CTA that re-opens the chat thread after the rider has
 * dismissed the auto-popup. Once every alert on this ride is
 * resolved, the endpoint returns an empty list and the pill goes away.
 *
 * Ordered most-recent first so the pill always points at the freshest
 * thread (typically the escalated SOS rather than the original
 * unusual_stop) when multiple are open.
 *
 * Rider can only see alerts on their own rides — service role +
 * explicit rider_id check below.
 */

export const dynamic = "force-dynamic";

export async function GET(
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

  // Confirm the rider owns the ride.
  const { data: ride } = await supabase
    .from("rides")
    .select("id, rider_id")
    .eq("id", id)
    .maybeSingle();
  if (!ride || ride.rider_id !== user.id) {
    return NextResponse.json({ alerts: [] });
  }

  const { data: rows } = await supabase
    .from("safety_alerts")
    .select("id, kind, status, message, created_at, acknowledged_at")
    .eq("ride_id", id)
    .eq("rider_id", user.id)
    .in("status", ["open", "acknowledged"])
    .order("created_at", { ascending: false });

  const alerts = (rows ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as "sos" | "flag" | "unusual_stop" | "off_route",
    status: r.status as "open" | "acknowledged",
    message: (r.message as string | null) ?? null,
    createdAt: r.created_at as string,
    /** True when an officer / admin has acked the alert — useful for
     *  showing "Officer is on it" on the rider's pill. */
    acknowledged: r.acknowledged_at !== null,
  }));

  return NextResponse.json({ alerts });
}
