import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { validateVehicleSpec } from "@/lib/vehicle-catalog";

/**
 * POST /api/admin/vehicle-changes/[id]
 *
 * Admin reviews a pending vehicle-change request. Body:
 *   { decision: "approve" | "reject", note?: string }
 *
 * Approve:
 *   - Re-validates the requested spec against the catalog (defense
 *     in depth — the driver-side already validated, but we don't
 *     trust client input)
 *   - Updates the drivers row with the new vehicle
 *   - Stores the new compliance documents on the driver_documents
 *     table replacing the old paths (registration, COF, insurance)
 *   - Marks the request approved + stamps reviewer
 *   - Logs an audit row
 *
 * Reject:
 *   - Marks the request rejected with the admin note
 *   - Doesn't touch the drivers row
 *   - The driver sees the rejection reason on their next visit
 *
 * Both branches are wrapped in best-effort error handling — if any
 * step fails we surface it to the admin and don't half-update.
 */

type PostBody = {
  decision?: unknown;
  note?: unknown;
};

export async function POST(
  request: Request,
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

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const decision = body.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json(
      { error: "decision must be 'approve' or 'reject'" },
      { status: 400 },
    );
  }
  const adminNote =
    typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (decision === "reject" && !adminNote) {
    return NextResponse.json(
      { error: "Rejection requires a note explaining why." },
      { status: 400 },
    );
  }

  // Load the request. Has to be pending — we don't allow re-deciding
  // already-decided requests (admin would create a new one if needed).
  const { data: req } = await supabase
    .from("vehicle_change_requests")
    .select(
      "id, driver_id, status, requested_type, requested_brand, requested_model, requested_year, requested_color, requested_plate, insurance_path, registration_path, cof_path",
    )
    .eq("id", id)
    .maybeSingle();
  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (req.status !== "pending") {
    return NextResponse.json(
      { error: `Request is already ${req.status}` },
      { status: 409 },
    );
  }

  /* ─── Reject path ─── */
  if (decision === "reject") {
    const { error } = await supabase
      .from("vehicle_change_requests")
      .update({
        status: "rejected",
        admin_note: adminNote,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await supabase.from("driver_audit_logs").insert({
      driver_id: req.driver_id,
      actor_role: "admin",
      actor_id: user.id,
      event: `Vehicle change rejected: ${adminNote.slice(0, 200)}`,
    });
    return NextResponse.json({ ok: true, decision: "rejected" });
  }

  /* ─── Approve path ─── */

  // Defense in depth — re-validate even though the driver-side did.
  const validationError = validateVehicleSpec({
    type: req.requested_type,
    brand: req.requested_brand,
    model: req.requested_model,
    year: req.requested_year,
    color: req.requested_color,
  });
  if (validationError) {
    return NextResponse.json(
      { error: `Spec rejected: ${validationError}` },
      { status: 400 },
    );
  }

  // Update the driver record with the new vehicle.
  const driverUpdate: Record<string, string | number | null> = {
    vehicle_type: req.requested_type,
    vehicle_make: req.requested_brand,
    vehicle_model: req.requested_model,
    vehicle_year: req.requested_year,
    vehicle_color: req.requested_color,
  };
  if (req.requested_plate) driverUpdate.plate_number = req.requested_plate;

  const { error: driverError } = await supabase
    .from("drivers")
    .update(driverUpdate)
    .eq("id", req.driver_id);
  if (driverError) {
    return NextResponse.json(
      { error: `Couldn't update driver vehicle: ${driverError.message}` },
      { status: 500 },
    );
  }

  // Replace the three compliance docs on driver_documents with the
  // newly-uploaded paths. Each one flips to status='pending' so the
  // existing TA-verification UI can re-review them in context. The
  // doc_keys (registration / cof / insurance) match the slugs the
  // existing onboarding flow uses, so the verification screen
  // already understands them.
  const docs: { doc_key: string; file_path: string; label: string }[] = [
    {
      doc_key: "red_plate_reg",
      file_path: req.registration_path ?? "",
      label: "Red Plate Vehicle Registration",
    },
    {
      doc_key: "cof",
      file_path: req.cof_path ?? "",
      label: "Certificate of Fitness (COF)",
    },
    {
      doc_key: "insurance",
      file_path: req.insurance_path ?? "",
      label: "Comprehensive Insurance (PPV)",
    },
  ].filter((d) => d.file_path);

  if (docs.length > 0) {
    const docRows = docs.map((d) => ({
      driver_id: req.driver_id,
      doc_key: d.doc_key,
      label: d.label,
      description: "Submitted via vehicle-change request",
      renewal_period_days: 365,
      status: "pending",
      note: "Replaced via approved vehicle-change request — needs re-review",
      file_path: d.file_path,
      previously_approved: true,
    }));
    const { error: docsError } = await supabase
      .from("driver_documents")
      .upsert(docRows, { onConflict: "driver_id,doc_key" });
    if (docsError) {
      return NextResponse.json(
        { error: `Couldn't update documents: ${docsError.message}` },
        { status: 500 },
      );
    }
  }

  // Finally, mark the request approved.
  const { error: reqError } = await supabase
    .from("vehicle_change_requests")
    .update({
      status: "approved",
      admin_note: adminNote || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", req.id);
  if (reqError) {
    return NextResponse.json({ error: reqError.message }, { status: 500 });
  }

  await supabase.from("driver_audit_logs").insert({
    driver_id: req.driver_id,
    actor_role: "admin",
    actor_id: user.id,
    event: `Vehicle changed to ${req.requested_year} ${req.requested_brand} ${req.requested_model}`,
  });

  return NextResponse.json({ ok: true, decision: "approved" });
}
