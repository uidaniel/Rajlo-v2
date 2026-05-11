import { NextResponse } from "next/server";
import { requireSafetyOfficerOrAdmin, logAdminAction } from "@/lib/admin-auth";

/**
 * GET   /api/admin/safety-alerts/[id]
 *   Full hydrated alert for the officer detail page — alert row +
 *   rider profile + driver profile (incl. plate) + ride context
 *   (pickup/dropoff/status/fare). One round-trip, all fields the UI
 *   needs to render the header.
 *
 * PATCH /api/admin/safety-alerts/[id]
 *
 * Admin acknowledges or resolves a safety alert.
 *
 * Body:
 *   { status: "acknowledged" | "resolved", resolution_note?: string }
 *
 *   - acknowledged → stamp acknowledged_at + acknowledged_by, leave
 *                     resolution_note alone
 *   - resolved     → stamp resolved_at, accept optional note
 *
 * Audit-logged so the safety queue has a clear paper trail.
 */

type Body = {
  status?: "acknowledged" | "resolved";
  resolution_note?: string;
};

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireSafetyOfficerOrAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const { data: alert, error } = await supabase
    .from("safety_alerts")
    .select(
      "id, ride_id, rider_id, driver_id, kind, message, lat, lng, status, acknowledged_at, acknowledged_by, resolved_at, resolution_note, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!alert) {
    return NextResponse.json({ error: "alert_not_found" }, { status: 404 });
  }

  // Hydrate rider, driver, ride in parallel.
  const [{ data: riderProfile }, { data: driverRow }, { data: rideRow }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("id", alert.rider_id as string)
        .maybeSingle(),
      alert.driver_id
        ? supabase
            .from("drivers")
            .select("id, full_name, phone, plate, vehicle_make, vehicle_model")
            .eq("id", alert.driver_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
          .from("rides")
          .select(
            "id, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, status, fare_jmd",
          )
          .eq("id", alert.ride_id as string)
          .maybeSingle(),
    ]);

  return NextResponse.json({
    alert: {
      id: alert.id as string,
      rideId: alert.ride_id as string,
      riderId: alert.rider_id as string,
      driverId: (alert.driver_id as string | null) ?? null,
      kind: alert.kind as "sos" | "flag" | "unusual_stop",
      message: (alert.message as string | null) ?? null,
      lat: alert.lat as number | null,
      lng: alert.lng as number | null,
      status: alert.status as "open" | "acknowledged" | "resolved",
      acknowledgedAt: (alert.acknowledged_at as string | null) ?? null,
      acknowledgedBy: (alert.acknowledged_by as string | null) ?? null,
      resolvedAt: (alert.resolved_at as string | null) ?? null,
      resolutionNote: (alert.resolution_note as string | null) ?? null,
      createdAt: alert.created_at as string,
      updatedAt: alert.updated_at as string,
    },
    rider: riderProfile
      ? {
          id: riderProfile.id as string,
          name: (riderProfile.full_name as string | null) ?? "Unknown rider",
          phone: (riderProfile.phone as string | null) ?? null,
        }
      : null,
    driver: driverRow
      ? {
          id: driverRow.id as string,
          name: (driverRow.full_name as string | null) ?? "Unknown driver",
          phone: (driverRow.phone as string | null) ?? null,
          plate: (driverRow.plate as string | null) ?? null,
          vehicle:
            [driverRow.vehicle_make, driverRow.vehicle_model]
              .filter(Boolean)
              .join(" ") || null,
        }
      : null,
    ride: rideRow
      ? {
          id: rideRow.id as string,
          status: rideRow.status as string,
          pickupName: rideRow.pickup_name as string,
          pickupLat: rideRow.pickup_lat as number,
          pickupLng: rideRow.pickup_lng as number,
          dropoffName: rideRow.dropoff_name as string,
          dropoffLat: rideRow.dropoff_lat as number,
          dropoffLng: rideRow.dropoff_lng as number,
          fareJmd: (rideRow.fare_jmd as number | null) ?? null,
        }
      : null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireSafetyOfficerOrAdmin();
  if (gate.error) return gate.error;
  const { supabase, actor } = gate;

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.status !== "acknowledged" && body.status !== "resolved") {
    return NextResponse.json(
      { error: "status must be 'acknowledged' or 'resolved'" },
      { status: 400 },
    );
  }

  const { data: alert } = await supabase
    .from("safety_alerts")
    .select("id, status, kind")
    .eq("id", id)
    .maybeSingle();
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {
    status: body.status,
    updated_at: new Date().toISOString(),
  };
  if (body.status === "acknowledged") {
    update.acknowledged_at = new Date().toISOString();
    update.acknowledged_by = actor.userId;
  } else if (body.status === "resolved") {
    update.resolved_at = new Date().toISOString();
    if (alert.status !== "acknowledged") {
      update.acknowledged_at = new Date().toISOString();
      update.acknowledged_by = actor.userId;
    }
    if (typeof body.resolution_note === "string") {
      update.resolution_note = body.resolution_note.trim().slice(0, 500);
    }
  }

  const { error } = await supabase
    .from("safety_alerts")
    .update(update)
    .eq("id", alert.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(supabase, actor, {
    // `ride` rather than a dedicated safety_alert target type — the
    // shared audit log enum doesn't include a `safety_alert` value
    // and we'd rather match the existing schema than introduce a
    // one-off migration just for this. The actual alert id goes in
    // metadata so it remains queryable.
    targetType: "ride",
    targetId: alert.id,
    targetLabel: `${alert.kind} safety alert`,
    action:
      body.status === "acknowledged"
        ? "acknowledge_safety_alert"
        : "resolve_safety_alert",
    summary:
      body.status === "acknowledged"
        ? `Acknowledged ${alert.kind} alert`
        : `Resolved ${alert.kind} alert${body.resolution_note ? ` — ${body.resolution_note.slice(0, 80)}` : ""}`,
    metadata: {
      alert_id: alert.id,
      kind: alert.kind,
      resolution_note: body.resolution_note ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
