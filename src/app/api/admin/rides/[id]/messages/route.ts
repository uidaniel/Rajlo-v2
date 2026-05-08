import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { shapeMessages } from "@/lib/ride-chat-shared";

/**
 * GET /api/admin/rides/[id]/messages
 *
 * Admin-only chat-log viewer. Returns every message on the given ride
 * regardless of ride status — the shared `/api/rides/[id]/messages`
 * endpoint also works for admins via the RLS `is_admin()` predicate,
 * but this dedicated path makes the audit intent obvious in server
 * logs and avoids any "did the rider get a 200 too?" ambiguity.
 *
 * Returns a slim profile of both participants so the viewer can show
 * "Andre Thompson (driver) → Marlon (rider)" header without N more
 * round-trips.
 */
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
  const { data: profile } = await auth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const [{ data: rows, error }, { data: ride }] = await Promise.all([
    supabase
      .from("ride_messages")
      .select(
        "id, ride_id, sender_id, sender_role, kind, body, duration_ms, read_at, created_at",
      )
      .eq("ride_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("rides")
      .select(
        "id, status, rider_id, driver_id, pickup_name, dropoff_name, requested_at, completed_at, cancelled_at",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  // Pull rider + driver display info for the header. One round trip
  // each — small enough that batching isn't worth the complexity.
  const [{ data: riderProfile }, driverInfo] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", ride.rider_id)
      .maybeSingle(),
    ride.driver_id
      ? supabase
          .from("drivers")
          .select("first_name, last_name, external_id")
          .eq("id", ride.driver_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const messages = await shapeMessages(supabase, rows ?? []);

  return NextResponse.json({
    ride: {
      id: ride.id,
      status: ride.status,
      pickup: ride.pickup_name,
      dropoff: ride.dropoff_name,
      requestedAt: ride.requested_at,
      endedAt: ride.completed_at ?? ride.cancelled_at,
      rider: {
        id: ride.rider_id,
        name: riderProfile?.full_name ?? "Rider",
      },
      driver: driverInfo.data
        ? {
            externalId: driverInfo.data.external_id,
            name:
              [
                driverInfo.data.first_name,
                driverInfo.data.last_name,
              ]
                .filter(Boolean)
                .join(" ") || "Driver",
          }
        : null,
    },
    messages,
  });
}
