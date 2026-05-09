import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { isWithinJamaica } from "@/lib/jamaica";

/**
 * POST /api/driver/route-taxi/sessions/position
 *
 * Driver pushes their current GPS to their active session. Drives:
 *   - Proximity-sorted hails (closest pickup first) on the driver's monitor
 *   - "X km away" labels on the rider's live status banner
 *   - Future: route-direction filtering, ETA estimates
 *
 * Body: { lat: number, lng: number }
 *
 * The browser fires this every ~15s while a session is on screen
 * (cheap — single UPDATE on the driver_sessions row). We reject coords
 * outside Jamaica's bounding box as a sanity gate against stuck-on-zero
 * fixes or test devices in the wrong country.
 */
type PositionBody = { lat?: unknown; lng?: unknown };

export async function POST(request: Request) {
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
      {
        error: "out_of_bounds",
        message: "GPS coordinates are outside Jamaica.",
      },
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

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json(
      { error: "Driver record not found" },
      { status: 404 },
    );
  }

  // Update only the active session — silently no-op if nothing's open
  // (a stale beacon from a stale tab shouldn't error the page).
  const { error } = await supabase
    .from("driver_sessions")
    .update({
      current_lat: lat,
      current_lng: lng,
      last_position_at: new Date().toISOString(),
    })
    .eq("driver_id", driver.id)
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
