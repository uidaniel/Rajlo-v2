import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/rides/[id]
 *
 * Single-ride deep dive for the admin's ride detail page. Pulls
 * everything an admin would want without forcing 5 parallel requests
 * from the page:
 *
 *   - ride row (status, parish, fare, timestamps, cancellation reason)
 *   - rider profile (name, phone, email)
 *   - driver row (external_id, plate, vehicle)
 *   - intermediate stops in position order
 *   - status timeline (ride_events)
 *   - rating (if any)
 *   - chat message count + the 5 most recent
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const { data: rideRow, error } = await supabase
    .from("rides")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rideRow) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  type RideRow = {
    id: string;
    status: string;
    rider_id: string;
    driver_id: string | null;
    pickup_name: string;
    pickup_address: string;
    pickup_parish: string | null;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_name: string;
    dropoff_address: string;
    dropoff_parish: string | null;
    dropoff_lat: number;
    dropoff_lng: number;
    seats: number;
    notes: string | null;
    estimated_fare_jmd: number;
    final_fare_jmd: number | null;
    estimated_distance_km: number | null;
    estimated_eta_minutes: number | null;
    requested_at: string;
    accepted_at: string | null;
    arrived_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
  };
  const ride = rideRow as RideRow;

  const [
    riderProfile,
    riderAuth,
    driverRow,
    stops,
    events,
    rating,
    chatCount,
    chatRecent,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("id", ride.rider_id)
      .maybeSingle(),
    supabase.auth.admin.getUserById(ride.rider_id).catch(() => ({ data: null })),
    ride.driver_id
      ? supabase
          .from("drivers")
          .select(
            "id, user_id, external_id, first_name, last_name, plate_number, vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, phone, email",
          )
          .eq("id", ride.driver_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("ride_stops")
      .select("position, name, address, parish, arrived_at, departed_at")
      .eq("ride_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("ride_events")
      .select("event, actor_role, actor_id, metadata, created_at")
      .eq("ride_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("ride_ratings")
      .select("stars, comment, rater_role, created_at")
      .eq("ride_id", id),
    supabase
      .from("ride_messages")
      .select("id", { count: "exact", head: true })
      .eq("ride_id", id),
    supabase
      .from("ride_messages")
      .select("id, kind, body, sender_role, created_at")
      .eq("ride_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    ride,
    rider: {
      id: ride.rider_id,
      fullName: (riderProfile.data as { full_name: string | null } | null)
        ?.full_name ?? "Rider",
      phone: (riderProfile.data as { phone: string | null } | null)?.phone ?? null,
      email:
        ("data" in riderAuth && riderAuth.data && "user" in riderAuth.data
          ? (riderAuth.data as { user: { email: string | null } | null }).user
              ?.email
          : null) ?? null,
    },
    driver: driverRow.data ?? null,
    stops: stops.data ?? [],
    events: events.data ?? [],
    ratings: rating.data ?? [],
    chat: {
      total: chatCount.count ?? 0,
      recent: chatRecent.data ?? [],
    },
  });
}
