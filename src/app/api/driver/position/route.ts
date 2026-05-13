import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { isWithinJamaica } from "@/lib/jamaica";

/**
 * POST /api/driver/position
 *
 * Driver pushes their last-known GPS while online (no active ride
 * required). Mirror of /api/driver/rides/[id]/position but lives at
 * the driver level so the new-ride matcher can find online drivers
 * by distance regardless of whether they have a trip in flight.
 *
 * Body: { lat: number, lng: number }
 *
 * Low cadence (~30s) — purely a cache so /api/rider/rides can filter
 * the push fan-out by radius. Failure here is non-fatal; the next
 * tick re-tries.
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
    return NextResponse.json({ error: "out_of_bounds" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("drivers")
    .update({
      last_lat: lat,
      last_lng: lng,
      last_position_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
