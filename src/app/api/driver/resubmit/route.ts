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
    /** Optional ISO date (YYYY-MM-DD). When omitted we keep whatever
     *  was previously on the row. Required server-side for any doc
     *  with `renewal_period_days > 0`. */
    expiresOn?: string | null;
  }>;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidFutureIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const ts = new Date(`${value}T00:00:00Z`).getTime();
  if (Number.isNaN(ts)) return false;
  // Allow a 1-day grace so a date set yesterday (timezones, etc.)
  // still passes through the focused-resubmit flow without forcing
  // the driver to bump it forward.
  return ts >= Date.now() - 24 * 60 * 60 * 1000;
}

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

  // Pull the existing rows so we know each doc's renewal period
  // (drives whether expiresOn is required) and the current expiry
  // (used as the fallback when the driver doesn't send a new one).
  const docKeys = body.uploadedDocs.map((d) => d.id);
  const { data: existingRows } = await supabase
    .from("driver_documents")
    .select("doc_key, renewal_period_days, expires_on")
    .eq("driver_id", driver.id)
    .in("doc_key", docKeys);
  const existingByKey = new Map(
    ((existingRows ?? []) as Array<{
      doc_key: string;
      renewal_period_days: number | null;
      expires_on: string | null;
    }>).map((r) => [r.doc_key, r]),
  );

  // Update each re-uploaded document. Status flips from "rejected" back to
  // "pending" so admins see a fresh review item.
  for (const doc of body.uploadedDocs) {
    if (!doc.filePath) continue;
    const existingDoc = existingByKey.get(doc.id);
    const renewalPeriod = existingDoc?.renewal_period_days ?? 0;

    // Resolve the expiry write:
    //   - undefined: keep existing
    //   - null:      clear (only valid for non-expiring docs)
    //   - string:    validate + use
    let resolvedExpiresOn: string | null;
    if (doc.expiresOn === undefined) {
      resolvedExpiresOn = existingDoc?.expires_on ?? null;
    } else if (doc.expiresOn === null || doc.expiresOn === "") {
      if (renewalPeriod > 0) {
        return NextResponse.json(
          { error: `Expiry date is required for ${doc.id}.` },
          { status: 400 },
        );
      }
      resolvedExpiresOn = null;
    } else if (typeof doc.expiresOn === "string") {
      if (!isValidFutureIsoDate(doc.expiresOn)) {
        return NextResponse.json(
          { error: `Expiry date for ${doc.id} must be a valid future YYYY-MM-DD.` },
          { status: 400 },
        );
      }
      resolvedExpiresOn = doc.expiresOn;
    } else {
      return NextResponse.json(
        { error: `Expiry date for ${doc.id} must be a string or null.` },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase
      .from("driver_documents")
      .update({
        status: "pending",
        file_path: doc.filePath,
        file_name: doc.fileName,
        expires_on: resolvedExpiresOn,
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
