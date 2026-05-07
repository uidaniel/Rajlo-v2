import { NextResponse } from "next/server";
import { requiredTADocuments } from "@/lib/mock-data";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import type { OnboardingSubmitRequest } from "@/lib/api-types";

export async function POST(request: Request) {
  const body = (await request.json()) as OnboardingSubmitRequest;

  if (!body?.form?.firstName || !body?.form?.lastName) {
    return NextResponse.json(
      { error: "Missing required onboarding fields" },
      { status: 400 },
    );
  }

  // Identify the signed-in user from the session — that's the canonical
  // identity. The body.driverId is ignored (legacy from mock mode).
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      source: "mock",
      message: "Stored in mock mode. Add Supabase env vars to persist.",
    });
  }

  // Look up any existing driver record for this user (drivers.user_id)
  const { data: existing } = await supabase
    .from("drivers")
    .select("id, external_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const driverFields = {
    user_id: user.id,
    first_name: body.form.firstName,
    last_name: body.form.lastName,
    phone: body.form.phone,
    email: body.form.email,
    trn: body.form.trn,
    nis: body.form.nis,
    licence_number: body.form.licenceNumber,
    licence_expiry: body.form.licenceExpiry || null,
    badge_number: body.form.badgeNumber || null,
    plate_number: body.form.plateNumber,
    vehicle_make: body.form.vehicleMake,
    vehicle_model: body.form.vehicleModel,
    vehicle_year: body.form.vehicleYear ? Number(body.form.vehicleYear) : null,
    franchise_number: body.form.franchiseNumber || null,
    franchise_expiry: body.form.franchiseExpiry || null,
    onboarding_status: "pending_review",
    activated: false,
    // Clear any admin note from a previous rejection — fresh review starts now.
    admin_note: null,
    // Timestamp the (re)submission so the pending screen can show an
    // accurate "X mins ago" instead of time since the row was first created.
    submitted_at: new Date().toISOString(),
  };

  let driverId: string;
  let externalId: string;
  const isResubmission = !!existing;

  if (existing) {
    // Resubmission — update in place. The auth-server's getDriverStatus()
    // returned `rejected`, otherwise the client-side gate would have blocked
    // the user from reaching this submit at all.
    const { data: updated, error: updateError } = await supabase
      .from("drivers")
      .update(driverFields)
      .eq("id", existing.id)
      .select("id, external_id")
      .single();
    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Failed to update driver profile" },
        { status: 500 },
      );
    }
    driverId = updated.id;
    externalId = updated.external_id;
  } else {
    // New driver — generate a short external_id (display id used in admin UI).
    externalId = `DRV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data: created, error: insertError } = await supabase
      .from("drivers")
      .insert({ ...driverFields, external_id: externalId })
      .select("id")
      .single();
    if (insertError || !created) {
      return NextResponse.json(
        { error: "Failed to create driver profile" },
        { status: 500 },
      );
    }
    driverId = created.id;
  }

  // Per-doc reconciliation. The naive approach (upsert every row with
  // status="pending") would clobber an already-approved doc the driver didn't
  // touch. Instead we look at what's currently in the DB and decide what
  // actually changed:
  //
  //   - File path identical to existing → no-op (preserve approved status)
  //   - File path differs and existing was approved → flip to pending +
  //     stamp `previously_approved=true` so the admin sees a clear
  //     "was approved, re-uploaded" indicator
  //   - File path differs and existing was rejected/pending → flip to pending
  //     (standard resubmission)
  //   - No existing row + new upload → fresh insert, status pending
  //   - No existing row + no upload → insert as missing
  //   - Existing row, no upload → leave alone
  const uploadedById = new Map(body.uploadedDocs.map((d) => [d.id, d]));

  const { data: existingDocs } = await supabase
    .from("driver_documents")
    .select("doc_key, status, file_path, previously_approved")
    .eq("driver_id", driverId);
  const existingByKey = new Map(
    (existingDocs ?? []).map((d) => [d.doc_key, d]),
  );

  type DocRow = {
    driver_id: string;
    doc_key: string;
    label: string;
    description: string;
    renewal_period_days: number;
    expires_on: string | null;
    status: string;
    note: string;
    file_name: string | null;
    file_path: string | null;
    previously_approved: boolean;
  };
  const rowsToWrite: DocRow[] = [];

  for (const doc of requiredTADocuments) {
    const uploaded = uploadedById.get(doc.id);
    const existing = existingByKey.get(doc.id);
    const baseRow = {
      driver_id: driverId,
      doc_key: doc.id,
      label: doc.label,
      description: doc.description,
      renewal_period_days: doc.renewalPeriodDays,
      expires_on: doc.expiryDate ?? null,
    };

    if (!existing) {
      // First-ever submission for this doc.
      rowsToWrite.push({
        ...baseRow,
        status: uploaded ? "pending" : "missing",
        note: uploaded ? "Submitted via onboarding flow" : "Not uploaded yet",
        file_name: uploaded?.fileName ?? null,
        file_path: uploaded?.filePath ?? null,
        previously_approved: false,
      });
      continue;
    }

    if (!uploaded) {
      // Driver didn't include this doc in the resubmission — leave the
      // existing row alone.
      continue;
    }

    if (uploaded.filePath === existing.file_path) {
      // File unchanged. Don't touch the row at all — preserves an existing
      // "approved" status without round-tripping it.
      continue;
    }

    // File replaced.
    const wasApproved = existing.status === "approved";
    rowsToWrite.push({
      ...baseRow,
      status: "pending",
      note: wasApproved
        ? "Replaced by driver after admin approval — needs re-review"
        : "Resubmitted via onboarding flow",
      file_name: uploaded.fileName,
      file_path: uploaded.filePath ?? null,
      previously_approved: wasApproved || existing.previously_approved === true,
    });
  }

  if (rowsToWrite.length > 0) {
    const { error: docsError } = await supabase
      .from("driver_documents")
      .upsert(rowsToWrite, { onConflict: "driver_id,doc_key" });

    if (docsError) {
      return NextResponse.json(
        { error: "Failed to upsert driver documents" },
        { status: 500 },
      );
    }
  }

  // Audit trail
  await supabase.from("driver_audit_logs").insert({
    driver_id: driverId,
    actor_role: "driver",
    actor_id: externalId,
    event: isResubmission
      ? "Driver resubmitted documents after rejection"
      : "Onboarding submitted for TA verification",
  });

  return NextResponse.json({ ok: true, source: "supabase", externalId });
}
