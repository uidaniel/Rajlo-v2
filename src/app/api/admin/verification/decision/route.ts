import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { AdminDecisionRequest } from "@/lib/api-types";

export async function POST(request: Request) {
  const body = (await request.json()) as AdminDecisionRequest;

  if (!body?.driverId || !Array.isArray(body.docs)) {
    return NextResponse.json({ error: "Invalid admin decision payload" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      source: "mock",
      message: "Decision accepted in mock mode. Add Supabase env vars to persist.",
    });
  }

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id")
    .eq("external_id", body.driverId)
    .single();

  if (driverError || !driver) {
    return NextResponse.json({ error: "Driver record not found" }, { status: 404 });
  }

  const updates = body.docs.map((doc) => ({
    driver_id: driver.id,
    doc_key: doc.id,
    status: doc.status === "resubmit" ? "rejected" : doc.status,
    note: doc.note || null,
  }));

  const { error: updateError } = await supabase
    .from("driver_documents")
    .upsert(updates, { onConflict: "driver_id,doc_key" });

  if (updateError) {
    return NextResponse.json({ error: "Failed to update document decisions" }, { status: 500 });
  }

  const allApproved = body.docs.every((d) => d.status === "approved");

  const { error: driverUpdateError } = await supabase
    .from("drivers")
    .update({
      activated: body.activateDriver && allApproved,
      onboarding_status: allApproved ? "approved" : "pending_corrections",
      admin_note: body.adminNote || null,
    })
    .eq("id", driver.id);

  if (driverUpdateError) {
    return NextResponse.json({ error: "Failed to update driver activation status" }, { status: 500 });
  }

  const { error: auditError } = await supabase.from("driver_audit_logs").insert({
    driver_id: driver.id,
    actor_role: "admin",
    actor_id: "admin-web",
    event: allApproved
      ? "Verification approved; driver activated"
      : "Verification reviewed; corrections requested",
  });

  if (auditError) {
    return NextResponse.json({ error: "Failed to write admin audit log" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, source: "supabase" });
}
