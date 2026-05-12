import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { isWithinJamaica } from "@/lib/jamaica";

/**
 * POST /api/driver/rides/[id]/position
 *
 * Driver pushes their last-known GPS to the rides row. Low cadence
 * (~10s) — purely a cache so admin / officer dashboards and refreshed
 * rider tabs have an instant marker on first paint without waiting
 * for the next Realtime Broadcast heartbeat.
 *
 * Body: { lat: number, lng: number }
 *
 * The richer "live" signal is still the per-ride Realtime channel
 * (`ride:<id>:position`). This endpoint is just a fallback / cache,
 * so failure here is non-fatal — the driver shouldn't see any UI
 * disruption if the POST fails.
 */

type PositionBody = { lat?: unknown; lng?: unknown };

export async function POST(
  request: Request,
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

  const body = (await request.json().catch(() => ({}))) as PositionBody;
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isWithinJamaica({ lat, lng })) {
    return NextResponse.json(
      { error: "out_of_bounds" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  // Confirm the caller is the driver on this ride. We look up via
  // drivers.user_id → drivers.id → rides.driver_id so a hijacked client
  // can't stamp positions on someone else's trip.
  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "not_driver" }, { status: 403 });
  }

  // Only update for non-terminal statuses — once the trip is completed
  // or cancelled, the cache is irrelevant and we don't want late
  // beacons resurrecting old rows.
  const { error } = await supabase
    .from("rides")
    .update({
      driver_last_lat: lat,
      driver_last_lng: lng,
      driver_last_position_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("driver_id", driver.id)
    .in("status", ["accepted", "arrived", "in_progress"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
