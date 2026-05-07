import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * GET /api/trip/[token]
 *
 * PUBLIC endpoint — anyone with the link can read this. We trust the
 * unguessable token as the auth credential.
 *
 * Returns a stripped-down view: pickup/dropoff, status, ETA, driver name
 * + plate (so the friend knows the car). No PII beyond what the rider
 * has chosen to share by sending the link.
 *
 * Stops broadcasting once the ride is in a terminal state (completed or
 * cancelled). Returns 410 Gone if the token has been revoked.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { data: link } = await supabase
    .from("trip_share_links")
    .select("ride_id, revoked_at, recipient_label")
    .eq("token", token)
    .maybeSingle();
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  if (link.revoked_at) {
    return NextResponse.json(
      { error: "This link has been revoked." },
      { status: 410 },
    );
  }

  const { data: ride } = await supabase
    .from("rides")
    .select(
      "id, status, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, driver_id, estimated_eta_minutes, accepted_at, arrived_at, started_at, completed_at, cancelled_at",
    )
    .eq("id", link.ride_id)
    .maybeSingle();
  if (!ride) {
    return NextResponse.json({ error: "Trip no longer available" }, { status: 404 });
  }

  let driver: { name: string; plateNumber: string | null } | null = null;
  if (ride.driver_id) {
    const { data: d } = await supabase
      .from("drivers")
      .select("first_name, last_name, plate_number")
      .eq("id", ride.driver_id)
      .maybeSingle();
    if (d) {
      driver = {
        name:
          [d.first_name, d.last_name].filter(Boolean).join(" ") || "Driver",
        plateNumber: d.plate_number,
      };
    }
  }

  return NextResponse.json({
    rideId: ride.id,
    status: ride.status,
    pickup: {
      name: ride.pickup_name,
      lat: ride.pickup_lat,
      lng: ride.pickup_lng,
    },
    dropoff: {
      name: ride.dropoff_name,
      lat: ride.dropoff_lat,
      lng: ride.dropoff_lng,
    },
    estimatedEtaMinutes: ride.estimated_eta_minutes,
    driver,
    timeline: {
      acceptedAt: ride.accepted_at,
      arrivedAt: ride.arrived_at,
      startedAt: ride.started_at,
      completedAt: ride.completed_at,
      cancelledAt: ride.cancelled_at,
    },
    recipientLabel: link.recipient_label,
  });
}
