import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/live-trips
 *
 * Returns every trip that's currently in-flight — private rides AND
 * route-taxi hails — so the admin can see them all at a glance on a
 * live map dashboard.
 *
 * "In-flight" means:
 *   - Private rides:   status IN (accepted, arrived, in_progress)
 *                       (we exclude `requested` because no driver has
 *                        accepted yet — no driver to track)
 *   - Route hails:     status IN (accepted, picked_up)
 *
 * For each trip we include:
 *   - pickup / dropoff coords (so the map can show static markers
 *     even before the realtime channel kicks in)
 *   - the driver's last-known position (from drivers.* / driver_sessions.*
 *     — populated by the fleet broadcaster's heartbeat)
 *   - the rider + driver display names for the side panel
 *   - the status so the UI can color-code
 *
 * The page polls this every ~8s and uses Supabase Realtime to layer
 * live driver-position pings on top.
 */

export const dynamic = "force-dynamic";

type Pos = { lat: number; lng: number } | null;

type LiveRide = {
  id: string;
  kind: "private";
  status: string;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  dropoffName: string;
  dropoffLat: number;
  dropoffLng: number;
  riderName: string;
  driverName: string;
  driverPlate: string | null;
  driverPosition: Pos;
  fareJmd: number;
  acceptedAt: string | null;
};

type LiveHail = {
  id: string;
  kind: "route_taxi";
  status: string;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  dropoffName: string;
  dropoffLat: number;
  dropoffLng: number;
  riderName: string;
  driverName: string;
  driverPlate: string | null;
  driverPosition: Pos;
  fareJmd: number;
  acceptedAt: string | null;
};

type LiveTrip = LiveRide | LiveHail;

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  // ─── Active private rides ───
  const { data: rideRows } = await supabase
    .from("rides")
    .select(
      "id, status, rider_id, driver_id, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, estimated_fare_jmd, final_fare_jmd, accepted_at",
    )
    .in("status", ["accepted", "arrived", "in_progress"])
    .order("accepted_at", { ascending: false })
    .limit(100);

  // ─── Active route-taxi hails ───
  const { data: hailRows } = await supabase
    .from("route_hails")
    .select(
      "id, status, rider_id, session_id, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, fare_jmd, accepted_at",
    )
    .in("status", ["accepted", "picked_up"])
    .order("accepted_at", { ascending: false })
    .limit(100);

  // ─── Hydrate names + driver positions in batch ───
  const riderIds = new Set<string>();
  const driverRowIds = new Set<string>();
  const sessionIds = new Set<string>();
  (rideRows ?? []).forEach((r) => {
    riderIds.add(r.rider_id);
    if (r.driver_id) driverRowIds.add(r.driver_id);
  });
  (hailRows ?? []).forEach((h) => {
    riderIds.add(h.rider_id);
    if (h.session_id) sessionIds.add(h.session_id);
  });

  // Rider names from profiles
  const profileMap = new Map<string, string>();
  if (riderIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(riderIds));
    (profiles ?? []).forEach((p) => {
      const name = (p.full_name as string | null)?.trim();
      if (p.id) profileMap.set(p.id as string, name || "Rider");
    });
  }

  // Driver names + position from drivers table (private rides)
  const driverMap = new Map<
    string,
    { name: string; plate: string | null }
  >();
  if (driverRowIds.size > 0) {
    const { data: drivers } = await supabase
      .from("drivers")
      .select("id, first_name, last_name, plate_number")
      .in("id", Array.from(driverRowIds));
    (drivers ?? []).forEach((d) => {
      const name =
        [d.first_name, d.last_name].filter(Boolean).join(" ").trim() || "Driver";
      driverMap.set(d.id as string, {
        name,
        plate: (d.plate_number as string | null) ?? null,
      });
    });
  }

  // Session-side: driver names + cached GPS for route hails
  const sessionMap = new Map<
    string,
    {
      name: string;
      plate: string | null;
      lat: number | null;
      lng: number | null;
    }
  >();
  if (sessionIds.size > 0) {
    const { data: sessions } = await supabase
      .from("driver_sessions")
      .select(
        "id, driver_id, current_lat, current_lng, drivers!inner(first_name, last_name, plate_number)",
      )
      .in("id", Array.from(sessionIds));
    (sessions ?? []).forEach((row) => {
      // The PostgREST nested select returns drivers as either a row or
      // an array depending on cardinality detection. Cast through
      // `unknown` and normalise to the array case (Supabase returns
      // an array on `!inner` joins).
      const session = row as unknown as {
        id: string;
        current_lat: number | null;
        current_lng: number | null;
        drivers:
          | { first_name?: string | null; last_name?: string | null; plate_number?: string | null }
          | Array<{ first_name?: string | null; last_name?: string | null; plate_number?: string | null }>
          | null;
      };
      const drv = Array.isArray(session.drivers)
        ? session.drivers[0] ?? {}
        : session.drivers ?? {};
      const name =
        [drv.first_name, drv.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "Driver";
      sessionMap.set(session.id, {
        name,
        plate: drv.plate_number ?? null,
        lat: session.current_lat ?? null,
        lng: session.current_lng ?? null,
      });
    });
  }

  const liveRides: LiveRide[] = (rideRows ?? []).map((r) => {
    const driver = r.driver_id ? driverMap.get(r.driver_id) : null;
    return {
      id: r.id as string,
      kind: "private",
      status: r.status as string,
      pickupName: r.pickup_name as string,
      pickupLat: Number(r.pickup_lat),
      pickupLng: Number(r.pickup_lng),
      dropoffName: r.dropoff_name as string,
      dropoffLat: Number(r.dropoff_lat),
      dropoffLng: Number(r.dropoff_lng),
      riderName: profileMap.get(r.rider_id as string) ?? "Rider",
      driverName: driver?.name ?? "Driver",
      driverPlate: driver?.plate ?? null,
      // Private rides don't cache driver GPS in DB — the realtime
      // channel is the only source. Map will start with no marker
      // until the first ping arrives (typically within 5s heartbeat).
      driverPosition: null,
      fareJmd: Number(r.final_fare_jmd ?? r.estimated_fare_jmd ?? 0),
      acceptedAt: (r.accepted_at as string | null) ?? null,
    };
  });

  const liveHails: LiveHail[] = (hailRows ?? []).map((h) => {
    const session = h.session_id ? sessionMap.get(h.session_id) : null;
    const pos: Pos =
      session && session.lat !== null && session.lng !== null
        ? { lat: session.lat, lng: session.lng }
        : null;
    return {
      id: h.id as string,
      kind: "route_taxi",
      status: h.status as string,
      pickupName: h.pickup_name as string,
      pickupLat: Number(h.pickup_lat),
      pickupLng: Number(h.pickup_lng),
      dropoffName: h.dropoff_name as string,
      dropoffLat: Number(h.dropoff_lat),
      dropoffLng: Number(h.dropoff_lng),
      riderName: profileMap.get(h.rider_id as string) ?? "Rider",
      driverName: session?.name ?? "Driver",
      driverPlate: session?.plate ?? null,
      driverPosition: pos,
      fareJmd: Number(h.fare_jmd ?? 0),
      acceptedAt: (h.accepted_at as string | null) ?? null,
    };
  });

  const trips: LiveTrip[] = [...liveRides, ...liveHails].sort((a, b) => {
    const ta = a.acceptedAt ? new Date(a.acceptedAt).getTime() : 0;
    const tb = b.acceptedAt ? new Date(b.acceptedAt).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json({ trips });
}
