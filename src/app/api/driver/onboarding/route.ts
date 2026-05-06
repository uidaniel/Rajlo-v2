import { NextResponse } from "next/server";
import { requiredTADocuments } from "@/lib/mock-data";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { OnboardingSubmitRequest } from "@/lib/api-types";

export async function POST(request: Request) {
  const body = (await request.json()) as OnboardingSubmitRequest;

  if (!body?.driverId || !body?.form?.firstName || !body?.form?.lastName) {
    return NextResponse.json({ error: "Missing required onboarding fields" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      source: "mock",
      message: "Stored in mock mode. Add Supabase env vars to persist.",
    });
  }

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .upsert(
      {
        external_id: body.driverId,
        first_name: body.form.firstName,
        last_name: body.form.lastName,
        phone: body.form.phone,
        email: body.form.email,
        trn: body.form.trn,
        nis: body.form.nis,
        licence_number: body.form.licenceNumber,
        plate_number: body.form.plateNumber,
        vehicle_make: body.form.vehicleMake,
        vehicle_model: body.form.vehicleModel,
        vehicle_year: body.form.vehicleYear ? Number(body.form.vehicleYear) : null,
        onboarding_status: "pending_review",
        activated: false,
      },
      { onConflict: "external_id" }
    )
    .select("id")
    .single();

  if (driverError || !driver) {
    return NextResponse.json({ error: "Failed to upsert driver profile" }, { status: 500 });
  }

  const uploadedSet = new Set(body.uploadedDocs.map((d) => d.id));

  const documentRows = requiredTADocuments.map((doc) => ({
    driver_id: driver.id,
    doc_key: doc.id,
    label: doc.label,
    description: doc.description,
    renewal_period_days: doc.renewalPeriodDays,
    expires_on: doc.expiryDate ?? null,
    status: uploadedSet.has(doc.id) ? "pending" : "missing",
    note: uploadedSet.has(doc.id) ? "Submitted via onboarding flow" : "Not uploaded yet",
    file_name: body.uploadedDocs.find((u) => u.id === doc.id)?.fileName ?? null,
  }));

  const { error: docsError } = await supabase
    .from("driver_documents")
    .upsert(documentRows, { onConflict: "driver_id,doc_key" });

  if (docsError) {
    return NextResponse.json({ error: "Failed to upsert driver documents" }, { status: 500 });
  }

  const { error: auditError } = await supabase.from("driver_audit_logs").insert({
    driver_id: driver.id,
    actor_role: "driver",
    actor_id: body.driverId,
    event: "Onboarding submitted for TA verification",
  });

  if (auditError) {
    return NextResponse.json({ error: "Failed to write onboarding audit log" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, source: "supabase" });
}
