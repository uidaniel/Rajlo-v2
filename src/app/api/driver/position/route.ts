import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { isWithinJamaica } from "@/lib/jamaica";
import { detectGpsAnomaly } from "@/lib/gps-anomaly";
import { recalculateRiskScore } from "@/lib/risk-scoring";

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
 *
 * Fraud signal: each ping is compared against the previous one — if
 * the implied travel is physically impossible (a fake-GPS teleport),
 * a `gps_spoofing` fraud flag is raised and the risk score recomputed.
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

  // Read the previous fix so we can sanity-check the movement.
  const { data: prevDriver } = await supabase
    .from("drivers")
    .select("last_lat, last_lng, last_position_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const now = new Date();
  const { error } = await supabase
    .from("drivers")
    .update({
      last_lat: lat,
      last_lng: lng,
      last_position_at: now.toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ─── GPS-spoofing check ─── (best-effort; never blocks the update)
  if (
    prevDriver?.last_lat != null &&
    prevDriver?.last_lng != null &&
    prevDriver?.last_position_at
  ) {
    const anomaly = detectGpsAnomaly(
      {
        lat: prevDriver.last_lat as number,
        lng: prevDriver.last_lng as number,
        at: new Date(prevDriver.last_position_at as string).getTime(),
      },
      { lat, lng, at: now.getTime() },
    );
    if (anomaly) {
      // De-dupe: at most one unresolved gps_spoofing flag per driver
      // per hour, so a sustained teleport doesn't create dozens.
      const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
      const { count } = await supabase
        .from("fraud_flags")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("flag_type", "gps_spoofing")
        .is("resolved_at", null)
        .gte("created_at", hourAgo);
      if (!count || count === 0) {
        await supabase.from("fraud_flags").insert({
          user_id: user.id,
          flag_type: "gps_spoofing",
          severity: "critical",
          description: `Impossible travel detected: ${Math.round(
            anomaly.speedKmh,
          )} km/h over ${anomaly.distanceKm.toFixed(1)} km in ${Math.round(
            anomaly.elapsedSeconds,
          )}s`,
          metadata: { anomaly },
        });
        await recalculateRiskScore(supabase, user.id, "driver");
      }
    }
  }

  return NextResponse.json({ ok: true });
}
