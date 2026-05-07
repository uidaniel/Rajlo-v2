import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/driver/resubmit
 *
 * Slim endpoint for the focused resubmission flow on /driver/resubmit. Only
 * touches the documents that were re-uploaded — does NOT modify the driver's
 * form fields. Used when a driver only needs to fix flagged uploads after
 * an admin rejection.
 *
 * If a driver also needs to edit form data (rare — admin notes calling out
 * a TRN/licence typo), they go through /driver/onboarding?edit=1 which uses
 * /api/driver/onboarding instead.
 *
 * Body shape:
 *   { uploadedDocs: [{ id, fileName, filePath }, ...] }
 */
type ResubmitRequest = {
  uploadedDocs: Array<{
    id: string;
    fileName: string;
    filePath?: string;
  }>;
};

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ResubmitRequest;
  if (!Array.isArray(body?.uploadedDocs) || body.uploadedDocs.length === 0) {
    return NextResponse.json(
      { error: "No documents to resubmit" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      source: "mock",
      message: "Resubmission accepted in mock mode.",
    });
  }

  // Find this driver's record. Resubmission is only allowed when they're
  // currently in the rejected state — block re-uploads on other states.
  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id, external_id, onboarding_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (driverError || !driver) {
    return NextResponse.json(
      { error: "Driver record not found" },
      { status: 404 },
    );
  }

  if (driver.onboarding_status !== "rejected") {
    return NextResponse.json(
      { error: "Driver is not in a state that allows resubmission" },
      { status: 409 },
    );
  }

  // Update each re-uploaded document. Status flips from "rejected" back to
  // "pending" so admins see a fresh review item.
  for (const doc of body.uploadedDocs) {
    if (!doc.filePath) continue;
    const { error: updateError } = await supabase
      .from("driver_documents")
      .update({
        status: "pending",
        file_path: doc.filePath,
        file_name: doc.fileName,
        note: "Resubmitted via resubmission flow",
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq("driver_id", driver.id)
      .eq("doc_key", doc.id);
    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update ${doc.id}: ${updateError.message}` },
        { status: 500 },
      );
    }
  }

  // Move the driver back into pending review, clear the admin note, and
  // refresh `submitted_at` so the pending screen shows the resubmission time
  // (not the original onboarding time).
  const { error: driverUpdateError } = await supabase
    .from("drivers")
    .update({
      onboarding_status: "pending_review",
      admin_note: null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", driver.id);

  if (driverUpdateError) {
    return NextResponse.json(
      { error: `Failed to update driver: ${driverUpdateError.message}` },
      { status: 500 },
    );
  }

  await supabase.from("driver_audit_logs").insert({
    driver_id: driver.id,
    actor_role: "driver",
    actor_id: driver.external_id,
    event: "Driver resubmitted documents after rejection (focused flow)",
  });

  return NextResponse.json({
    ok: true,
    source: "supabase",
    externalId: driver.external_id,
  });
}
