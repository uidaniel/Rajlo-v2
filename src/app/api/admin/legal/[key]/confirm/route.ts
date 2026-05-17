import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { getLegalDocument } from "@/lib/legal-documents";
import { legalContentHash } from "@/lib/legal-store";

/**
 * POST /api/admin/legal/[key]/confirm
 *
 * Step 2 of the OTP-gated policy edit. The admin submits the OTP that
 * was mailed to them by `/request`. On a correct, unexpired code this
 * endpoint publishes the pending edit into `legal_documents` — the
 * policy is now live everywhere (the /legal pages + the consent
 * gate read the effective document).
 *
 * If the admin bumped the version, every user the policy applies to
 * will be put behind the consent gate on their next portal entry,
 * because `getOutstandingLegalDocuments` compares against this
 * freshly-published version.
 *
 * Guards: the code must match, must not be expired, and a small number
 * of wrong attempts burns the pending edit (the admin must restart).
 */

const MAX_ATTEMPTS = 5;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type Body = { otp?: unknown };

type PendingEdit = {
  doc_key: string;
  title: string;
  version: string;
  effective_date: string;
  summary: string;
  body: string;
  requested_by: string;
  otp_hash: string;
  otp_expires_at: string;
  attempts: number;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;

  const { key } = await params;
  const catalog = getLegalDocument(key);
  if (!catalog) {
    return NextResponse.json({ error: "Unknown policy." }, { status: 404 });
  }

  const raw = (await request.json().catch(() => ({}))) as Body;
  const otp = typeof raw.otp === "string" ? raw.otp.trim() : "";
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your email." },
      { status: 400 },
    );
  }

  const { data: pendingRaw } = await supabase
    .from("legal_document_edits")
    .select("*")
    .eq("doc_key", key)
    .maybeSingle();
  const pending = pendingRaw as PendingEdit | null;

  if (!pending) {
    return NextResponse.json(
      { error: "No pending edit — start the edit again." },
      { status: 400 },
    );
  }

  // Only the admin who started the edit may confirm it.
  if (pending.requested_by !== actor.userId) {
    return NextResponse.json(
      { error: "This edit was started by a different admin." },
      { status: 403 },
    );
  }

  if (Date.now() > new Date(pending.otp_expires_at).getTime()) {
    await supabase.from("legal_document_edits").delete().eq("doc_key", key);
    return NextResponse.json(
      { error: "That code has expired — start the edit again." },
      { status: 400 },
    );
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    await supabase.from("legal_document_edits").delete().eq("doc_key", key);
    return NextResponse.json(
      { error: "Too many incorrect codes — start the edit again." },
      { status: 429 },
    );
  }

  if (sha256(otp) !== pending.otp_hash) {
    await supabase
      .from("legal_document_edits")
      .update({ attempts: pending.attempts + 1 })
      .eq("doc_key", key);
    const left = MAX_ATTEMPTS - pending.attempts - 1;
    return NextResponse.json(
      {
        error:
          left > 0
            ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
            : "Incorrect code — start the edit again.",
      },
      { status: 400 },
    );
  }

  // ─── Publish ───
  const { error: publishError } = await supabase
    .from("legal_documents")
    .upsert(
      {
        key,
        title: pending.title,
        version: pending.version,
        effective_date: pending.effective_date,
        summary: pending.summary,
        body: pending.body,
        updated_at: new Date().toISOString(),
        updated_by: actor.userId,
        updated_by_email: actor.email,
      },
      { onConflict: "key" },
    );
  if (publishError) {
    return NextResponse.json({ error: publishError.message }, { status: 500 });
  }

  // Archive this published version permanently. Combined with the
  // committed .txt baselines, this guarantees the exact text behind
  // every consent record's content_hash stays recoverable even after
  // the policy is edited again.
  await supabase.from("legal_document_versions").upsert(
    {
      doc_key: key,
      version: pending.version,
      title: pending.title,
      body: pending.body,
      content_hash: legalContentHash(pending.body),
      archived_by: actor.userId,
    },
    { onConflict: "doc_key,version", ignoreDuplicates: true },
  );

  // Pending edit consumed.
  await supabase.from("legal_document_edits").delete().eq("doc_key", key);

  await logAdminAction(supabase, actor, {
    targetType: "system",
    targetId: key,
    targetLabel: pending.title,
    action: "legal_policy_published",
    summary: `${actor.label} published ${pending.title} (version ${pending.version})`,
    metadata: {
      docKey: key,
      version: pending.version,
      effectiveDate: pending.effective_date,
    },
  });

  return NextResponse.json({ ok: true, version: pending.version });
}
