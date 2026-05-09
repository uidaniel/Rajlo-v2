import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { requiredTADocuments } from "@/lib/mock-data";

/**
 * POST /api/driver/documents/[docKey]/replace
 *
 * Single-document upload / renewal endpoint.
 *
 * Works for any signed-in driver — the existing `/api/driver/resubmit`
 * endpoint hard-gates on `onboarding_status === 'rejected'`, so it
 * couldn't service active drivers needing to renew an expiring doc.
 * This one accepts replacements regardless of onboarding state and
 * just flips the affected document row to `pending` for admin review.
 *
 * Crucially, this DOESN'T touch `drivers.activated` or
 * `drivers.onboarding_status` for active drivers — they keep accepting
 * rides while admin re-reviews the new file. The doc itself is the
 * unit of compliance, and the admin verification queue already
 * surfaces any pending row for review.
 *
 * Body shape:
 *   { fileName: string, filePath: string }
 * `filePath` must point inside the calling driver's own folder in the
 * `driver-documents` storage bucket — storage RLS already enforces
 * that on the upload step; we double-check the path prefix here.
 */

type Body = {
  fileName?: unknown;
  filePath?: unknown;
  /** Optional ISO date (YYYY-MM-DD). When provided we persist it as
   *  `expires_on` so the driver's compliance page + admin queue show
   *  the real renewal date instead of an empty cell. Required for
   *  every doc with `renewal_period_days > 0` enforced server-side. */
  expiresOn?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ docKey: string }> },
) {
  const { docKey } = await params;
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Validate the doc_key against the canonical list — prevents
  // client-side typos from creating orphan rows.
  const docMeta = requiredTADocuments.find((d) => d.id === docKey);
  if (!docMeta) {
    return NextResponse.json(
      { error: "Unknown document type" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const fileName =
    typeof body.fileName === "string" ? body.fileName.trim() : "";
  const filePath =
    typeof body.filePath === "string" ? body.filePath.trim() : "";
  if (!fileName || !filePath) {
    return NextResponse.json(
      { error: "fileName and filePath are required" },
      { status: 400 },
    );
  }

  // Validate the expiry date. We accept YYYY-MM-DD only, must be in
  // the future, and only required for docs that actually expire
  // (renewal_period_days > 0 — the selfie has 0 since it never
  // expires). Pass null to clear; omit to leave existing value alone.
  const expiresOnRaw =
    typeof body.expiresOn === "string" ? body.expiresOn.trim() : null;
  let expiresOn: string | null | undefined; // undefined = "don't touch"
  if (expiresOnRaw === "" || expiresOnRaw === null) {
    if (docMeta.renewalPeriodDays > 0 && body.expiresOn !== undefined) {
      return NextResponse.json(
        { error: "Expiry date is required for this document type." },
        { status: 400 },
      );
    }
    expiresOn = body.expiresOn === undefined ? undefined : null;
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOnRaw)) {
      return NextResponse.json(
        { error: "Expiry must be a date in YYYY-MM-DD format." },
        { status: 400 },
      );
    }
    const parsed = new Date(`${expiresOnRaw}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "Expiry date isn't valid." },
        { status: 400 },
      );
    }
    if (parsed.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: "Expiry date can't be in the past." },
        { status: 400 },
      );
    }
    expiresOn = expiresOnRaw;
  }

  // Defense-in-depth path check. Storage RLS already enforces this on
  // upload, but we also confirm here so a forged path can't be
  // recorded against the row.
  if (!filePath.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: "filePath must live in your own folder" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, external_id, onboarding_status, activated, deactivated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Was this doc previously approved? If so, mark `previously_approved`
  // so the admin queue shows the "was approved · needs re-review"
  // badge instead of treating it like a brand-new submission. Also
  // pull the prior `expires_on` so we don't clobber it when the
  // driver leaves the date field blank.
  const { data: existing } = await supabase
    .from("driver_documents")
    .select("status, previously_approved, expires_on")
    .eq("driver_id", driver.id)
    .eq("doc_key", docKey)
    .maybeSingle();
  const wasApproved = existing?.status === "approved";

  // Resolve the final expires_on to write:
  //   - undefined (driver didn't send the field): keep existing value
  //   - null      (driver explicitly cleared):    null
  //   - string    (driver provided new date):     the new date
  const resolvedExpiresOn =
    expiresOn === undefined ? existing?.expires_on ?? null : expiresOn;

  // Upsert. The renewal flow uses the same row keyed on
  // (driver_id, doc_key) — there's a unique constraint there from the
  // onboarding migration.
  const { error: upsertError } = await supabase.from("driver_documents").upsert(
    {
      driver_id: driver.id,
      doc_key: docKey,
      label: docMeta.label,
      description: docMeta.description,
      renewal_period_days: docMeta.renewalPeriodDays,
      expires_on: resolvedExpiresOn,
      status: "pending",
      note:
        wasApproved
          ? "Driver renewed an approved document — needs re-review"
          : existing?.status === "rejected"
            ? "Driver resubmitted after rejection"
            : "Driver uploaded a new document",
      file_name: fileName,
      file_path: filePath,
      previously_approved:
        wasApproved || existing?.previously_approved === true,
      reviewed_by: null,
      reviewed_at: null,
    },
    { onConflict: "driver_id,doc_key" },
  );

  if (upsertError) {
    return NextResponse.json(
      { error: `Couldn't save document: ${upsertError.message}` },
      { status: 500 },
    );
  }

  // Audit log so the admin verification detail page shows when + what
  // the driver did. This is the same table the rejection / approval
  // events write to, so the admin UI's existing audit timeline picks
  // this up without changes.
  await supabase.from("driver_audit_logs").insert({
    driver_id: driver.id,
    actor_role: "driver",
    actor_id: driver.external_id,
    event: `Driver ${
      wasApproved
        ? "renewed approved"
        : existing?.status === "rejected"
          ? "resubmitted rejected"
          : "uploaded missing"
    } document: ${docMeta.label}`,
  });

  return NextResponse.json({
    ok: true,
    docKey,
    docLabel: docMeta.label,
    previouslyApproved: wasApproved,
  });
}
