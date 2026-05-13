import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/driver-violations
 *
 * Lists driver behavioural violations for the admin violations
 * dashboard. Supports:
 *   ?status=open|resolved|all          (default: open)
 *   ?driverId=<uuid>                    (filter to one driver)
 *   ?limit=100&offset=0
 *
 * Each row hydrates the driver's display name + plate + activation
 * state so the dashboard is scannable without per-row lookups.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") ?? "open";
  const driverId = sp.get("driverId");
  const limit = Math.min(
    200,
    Math.max(1, Number(sp.get("limit") ?? "100") || 100),
  );
  const offset = Math.max(0, Number(sp.get("offset") ?? "0") || 0);

  let query = supabase
    .from("driver_violations")
    .select(
      "id, driver_id, ride_id, kind, details, resolved_at, admin_notes, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === "open") query = query.is("resolved_at", null);
  else if (status === "resolved") query = query.not("resolved_at", "is", null);
  if (driverId) query = query.eq("driver_id", driverId);

  const { data: rows, count } = await query;
  if (!rows || rows.length === 0) {
    return NextResponse.json({ violations: [], total: count ?? 0 });
  }

  const driverIds = Array.from(new Set(rows.map((r) => r.driver_id as string)));
  const { data: drivers } = await supabase
    .from("drivers")
    .select(
      "id, first_name, last_name, plate_number, activated, deactivated_at, deactivation_reason",
    )
    .in("id", driverIds);
  const driverMap = new Map(
    (drivers ?? []).map((d) => [d.id as string, d]),
  );

  const violations = rows.map((r) => {
    const d = driverMap.get(r.driver_id as string);
    return {
      id: r.id as string,
      driverId: r.driver_id as string,
      driverName: d
        ? [d.first_name, d.last_name].filter(Boolean).join(" ") || "Driver"
        : "Driver",
      driverPlate: (d?.plate_number as string | null) ?? null,
      driverActivated: !!d?.activated,
      driverDeactivatedAt: (d?.deactivated_at as string | null) ?? null,
      driverDeactivationReason: (d?.deactivation_reason as string | null) ?? null,
      rideId: (r.ride_id as string | null) ?? null,
      kind: r.kind as string,
      details: (r.details as string | null) ?? null,
      resolvedAt: (r.resolved_at as string | null) ?? null,
      adminNotes: (r.admin_notes as string | null) ?? null,
      createdAt: r.created_at as string,
    };
  });

  return NextResponse.json({ violations, total: count ?? 0 });
}
