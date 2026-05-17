import { NextResponse } from "next/server";
import { randomInt, createHash } from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { getLegalDocument } from "@/lib/legal-documents";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/admin/legal/[key]/request
 *
 * Step 1 of the OTP-gated policy edit. The admin submits the proposed
 * new content; this endpoint:
 *   1. validates the admin + the document key + the fields
 *   2. generates a 6-digit OTP, stores its SHA-256 hash in a pending
 *      `legal_document_edits` row (replacing any prior pending edit
 *      for the same document)
 *   3. emails the OTP to the admin's own email
 *
 * The edit is NOT published here — it's published by the matching
 * `/confirm` endpoint once the admin enters the OTP. This two-step
 * gate means a policy can't be changed by a single compromised
 * session: an attacker would also need the admin's email inbox.
 */

const OTP_TTL_MINUTES = 10;

type Body = {
  title?: unknown;
  version?: unknown;
  effectiveDate?: unknown;
  summary?: unknown;
  body?: unknown;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** "raj@rajlo.com" → "r•••@rajlo.com" — shown back so the admin knows
 *  which inbox to check without echoing the full address. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, local.length - 1))}@${domain}`;
}

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

  if (!actor.email) {
    return NextResponse.json(
      {
        error:
          "Your admin account has no email on file — an OTP can't be sent.",
      },
      { status: 400 },
    );
  }

  const raw = (await request.json().catch(() => ({}))) as Body;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const version = typeof raw.version === "string" ? raw.version.trim() : "";
  const effectiveDate =
    typeof raw.effectiveDate === "string" ? raw.effectiveDate.trim() : "";
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";

  if (!title || title.length > 200) {
    return NextResponse.json(
      { error: "Title is required (max 200 characters)." },
      { status: 400 },
    );
  }
  if (!version || version.length > 32) {
    return NextResponse.json(
      { error: "Version is required (max 32 characters)." },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || Number.isNaN(Date.parse(effectiveDate))) {
    return NextResponse.json(
      { error: "Effective date must be a valid YYYY-MM-DD date." },
      { status: 400 },
    );
  }
  if (!summary || summary.length > 300) {
    return NextResponse.json(
      { error: "Summary is required (max 300 characters)." },
      { status: 400 },
    );
  }
  if (!body || body.length < 50) {
    return NextResponse.json(
      { error: "Policy body looks too short — please check the content." },
      { status: 400 },
    );
  }

  // 6-digit OTP via a cryptographically-secure RNG.
  const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const otpExpiresAt = new Date(
    Date.now() + OTP_TTL_MINUTES * 60_000,
  ).toISOString();

  // Upsert the pending edit — one per document, latest submission wins.
  const { error: upsertError } = await supabase
    .from("legal_document_edits")
    .upsert(
      {
        doc_key: key,
        title,
        version,
        effective_date: effectiveDate,
        summary,
        body,
        requested_by: actor.userId,
        requested_by_email: actor.email,
        otp_hash: sha256(otp),
        otp_expires_at: otpExpiresAt,
        attempts: 0,
      },
      { onConflict: "doc_key" },
    );
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Email the OTP to the admin.
  const emailResult = await sendEmail({
    to: actor.email,
    subject: `RAJLO — verification code to publish "${catalog.title}"`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
      <p style="font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#f10100">RAJLO Admin</p>
      <h2 style="font-size:20px;margin:8px 0 4px">Confirm a policy update</h2>
      <p style="font-size:14px;color:#475569;line-height:1.6">
        You're about to publish a change to <strong>${catalog.title}</strong>.
        Enter this code in the admin panel to publish it:
      </p>
      <p style="font-size:34px;font-weight:800;letter-spacing:.3em;margin:18px 0;color:#111906">${otp}</p>
      <p style="font-size:13px;color:#475569;line-height:1.6">
        This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't
        request this, do not enter the code — your account may be
        compromised.
      </p>
    </div>`,
    text: `RAJLO Admin — verification code to publish "${catalog.title}": ${otp}. Expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, do not enter the code.`,
  });

  if (!emailResult.ok) {
    // The pending edit row exists but no code reached the admin. Tell
    // them so they don't sit waiting for an email that isn't coming.
    return NextResponse.json(
      {
        error:
          "skipped" in emailResult
            ? "Email sending isn't configured on this environment — set RESEND_API_KEY."
            : `Couldn't send the verification email: ${emailResult.error}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    sentTo: maskEmail(actor.email),
    expiresInMinutes: OTP_TTL_MINUTES,
  });
}
