import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";

/**
 * PATCH /api/admin/driver-violations/[id]
 *
 * Admin actions:
 *   { action: "resolve", notes?: string }
 *     Mark the violation row resolved. If this clears the driver's
 *     unresolved-count below the 2-strike threshold AND the driver
 *     is currently deactivated FOR location_violations, also
 *     reactivate them (clears deactivated_at + deactivation_reason).
 *
 *   { action: "reactivate", notes?: string }
 *     Resolve every open violation for the driver AND clear their
 *     deactivation. Used when admin wants to give the driver a clean
 *     slate. Does NOT require the driver to resubmit documents —
 *     this is a behavioural pause, not a verification reset.
 */

type Body = { action?: "resolve" | "reactivate"; notes?: string };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase, actor } = gate;

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.action !== "resolve" && body.action !== "reactivate") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  const { data: violation } = await supabase
    .from("driver_violations")
    .select("id, driver_id, resolved_at")
    .eq("id", id)
    .maybeSingle();
  if (!violation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const driverId = violation.driver_id as string;
  const nowIso = new Date().toISOString();

  if (body.action === "resolve") {
    if (!violation.resolved_at) {
      await supabase
        .from("driver_violations")
        .update({
          resolved_at: nowIso,
          resolved_by: actor.userId,
          admin_notes: notes,
        })
        .eq("id", id);
    }
  } else {
    // reactivate: resolve EVERY open violation for the driver + clear
    // the deactivation. Idempotent — re-running is a no-op.
    await supabase
      .from("driver_violations")
      .update({
        resolved_at: nowIso,
        resolved_by: actor.userId,
        admin_notes: notes ?? "Reactivated by admin",
      })
      .eq("driver_id", driverId)
      .is("resolved_at", null);
    await supabase
      .from("drivers")
      .update({
        deactivated_at: null,
        deactivation_reason: null,
      })
      .eq("id", driverId)
      .eq("deactivation_reason", "location_violations");
  }

  // Side effect: after resolving a violation (not reactivating),
  // check whether the driver's unresolved-count just dropped below 2.
  // If so AND they were deactivated for location_violations, also
  // clear the deactivation — same logic as full reactivate but
  // triggered surgically.
  if (body.action === "resolve") {
    const { count: unresolved } = await supabase
      .from("driver_violations")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", driverId)
      .is("resolved_at", null);
    if ((unresolved ?? 0) < 2) {
      await supabase
        .from("drivers")
        .update({ deactivated_at: null, deactivation_reason: null })
        .eq("id", driverId)
        .eq("deactivation_reason", "location_violations");
    }
  }

  await logAdminAction(supabase, actor, {
    targetType: "driver",
    targetId: driverId,
    targetLabel: `driver ${driverId.slice(0, 8)}`,
    action:
      body.action === "reactivate"
        ? "reactivate_after_violations"
        : "resolve_driver_violation",
    summary:
      body.action === "reactivate"
        ? `Reactivated driver and cleared all violations${notes ? ` — ${notes}` : ""}`
        : `Resolved 1 violation${notes ? ` — ${notes}` : ""}`,
    metadata: { violation_id: id, notes },
  });

  return NextResponse.json({ ok: true });
}
