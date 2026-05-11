import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { APP_URL } from "@/lib/email-render";
import {
  sendAuthSignupConfirmEmail,
  sendAuthMagicLinkEmail,
  sendAuthPasswordRecoveryEmail,
  sendAuthInviteEmail,
  sendAuthEmailChangeEmail,
  sendAuthReauthenticationEmail,
} from "@/lib/email-templates";

/**
 * POST /api/auth/email-hook
 *
 * Receives every auth-email event from Supabase (signup confirmation,
 * password reset, magic link, invite, email change, reauthentication)
 * via Supabase's "Send Email Hook" feature, then renders + ships the
 * email through Rajlo's own Resend integration so every auth email
 * matches the rest of the platform's brand.
 *
 * Why we do this instead of editing Supabase's built-in templates:
 *  - One template source of truth (`renderEmail` + this file).
 *  - Iterating on copy is a deploy, not a click-through-the-dashboard.
 *  - Identical look across auth emails AND transactional emails
 *    (ride receipts, OTPs, driver approvals).
 *
 * Signature verification — Supabase uses the Standard Webhooks spec:
 *  - `webhook-id`         unique event id
 *  - `webhook-timestamp`  unix seconds — we tolerate ±5 min skew
 *  - `webhook-signature`  space-separated `v1,<base64-hmac>` entries
 *    (more than one is sent during secret rotation)
 *  - Signed content       `{webhook-id}.{webhook-timestamp}.{rawBody}`
 *  - Secret               env `SUPABASE_AUTH_HOOK_SECRET`
 *                          (Supabase Dashboard gives it as
 *                          `v1,whsec_<base64>`; we strip the prefix
 *                          and decode the bytes before HMAC).
 *
 * We MUST read the raw body before any other body access — the
 * signature is computed over the exact bytes Supabase sent.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

type AuthEmailActionType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email_change_current"
  | "reauthentication";

type AuthHookPayload = {
  user: {
    id: string;
    email: string;
    new_email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthEmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();

  // 1. Verify signature
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SUPABASE_AUTH_HOOK_SECRET not configured" },
      { status: 500 },
    );
  }
  const ok = verifyStandardWebhookSignature(rawBody, request.headers, secret);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  // 2. Parse + dispatch
  let payload: AuthHookPayload;
  try {
    payload = JSON.parse(rawBody) as AuthHookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { user, email_data } = payload;
  if (!user?.email || !email_data?.email_action_type) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // 3. Build the confirmation URL Supabase expects us to deliver.
  // Pattern matches Supabase's hosted verification endpoint — the
  // tap from the email lands at Supabase's `/auth/v1/verify`, which
  // validates the token and then redirects to `redirect_to`.
  const confirmationUrl = buildConfirmationUrl(email_data);

  // Pull a first-name hint from user metadata if available — improves
  // copy ("Welcome, Marcus") without breaking when metadata is empty.
  const firstName = pickFirstName(user.user_metadata);

  // 4. Route to the right template by action type.
  try {
    switch (email_data.email_action_type) {
      case "signup":
        await sendAuthSignupConfirmEmail(user.email, {
          firstName,
          confirmationUrl,
        });
        break;
      case "magiclink":
        await sendAuthMagicLinkEmail(user.email, {
          firstName,
          confirmationUrl,
        });
        break;
      case "recovery":
        await sendAuthPasswordRecoveryEmail(user.email, {
          firstName,
          confirmationUrl,
        });
        break;
      case "invite":
        await sendAuthInviteEmail(user.email, { firstName, confirmationUrl });
        break;
      case "email_change":
      case "email_change_current":
        await sendAuthEmailChangeEmail(user.email, {
          firstName,
          confirmationUrl,
          newEmail: user.new_email ?? user.email,
        });
        break;
      case "reauthentication":
        await sendAuthReauthenticationEmail(user.email, {
          firstName,
          token: email_data.token,
        });
        break;
      default:
        // Unknown action — ack so Supabase doesn't retry forever,
        // but log it server-side so we notice.
        console.warn(
          "auth-email-hook: unknown action_type",
          email_data.email_action_type,
        );
        return NextResponse.json({ ok: true, ignored: true });
    }
  } catch (e) {
    // Resend / email send failed. Return 500 so Supabase retries
    // (the spec retries on non-2xx). Log the error message only —
    // never log the raw event body, which contains tokens.
    console.error(
      "auth-email-hook: send failed",
      e instanceof Error ? e.message : "unknown error",
    );
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Build the URL the recipient should tap. Supabase exposes the
 * primitives (token_hash + action_type + redirect) and expects us to
 * compose them. We point at Supabase's hosted /auth/v1/verify endpoint
 * which validates the token and then sends the user to `redirect_to`.
 *
 * Falls back to `APP_URL` if `site_url` isn't present in the payload
 * — defensive for replayed events from dev environments.
 */
function buildConfirmationUrl(emailData: AuthHookPayload["email_data"]): string {
  const base = (emailData.site_url || APP_URL).replace(/\/$/, "");
  const params = new URLSearchParams({
    token_hash: emailData.token_hash,
    type: emailData.email_action_type,
  });
  if (emailData.redirect_to) {
    params.set("redirect_to", emailData.redirect_to);
  }
  return `${base}/auth/v1/verify?${params.toString()}`;
}

function pickFirstName(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  const candidates = [meta.first_name, meta.full_name, meta.name];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      return c.trim().split(/\s+/)[0];
    }
  }
  return null;
}

/**
 * Verify a Standard Webhooks signature.
 *
 * Steps:
 *   1. Pull `webhook-id` / `webhook-timestamp` / `webhook-signature`
 *      headers.
 *   2. Reject anything older than 5 minutes (replay protection).
 *   3. Strip the `v1,whsec_` prefix off the secret and base64-decode
 *      to get the raw HMAC key bytes.
 *   4. Compute HMAC-SHA256 over `{id}.{timestamp}.{body}`.
 *   5. Compare against each signature in the header (Supabase may
 *      send multiple during rotation) using constant-time compare.
 */
function verifyStandardWebhookSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const webhookId = headers.get("webhook-id");
  const webhookTimestamp = headers.get("webhook-timestamp");
  const webhookSignature = headers.get("webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;

  // Supabase distributes the secret in the form `v1,whsec_<base64>`.
  // Strip either prefix.
  const secretBytes = decodeWebhookSecret(secret);
  if (!secretBytes) return false;

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expectedSig = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest();

  // Header is `v1,<base64> v1,<base64>` — iterate, accept first match.
  const candidates = webhookSignature.split(" ");
  for (const entry of candidates) {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) continue;
    let actual: Buffer;
    try {
      actual = Buffer.from(value, "base64");
    } catch {
      continue;
    }
    if (actual.length !== expectedSig.length) continue;
    if (timingSafeEqual(actual, expectedSig)) return true;
  }
  return false;
}

function decodeWebhookSecret(secret: string): Buffer | null {
  // Supabase Dashboard surfaces the secret as `v1,whsec_<base64>` or
  // just `whsec_<base64>` depending on version. Strip whichever prefix
  // is present, then base64-decode.
  let raw = secret.trim();
  if (raw.startsWith("v1,")) raw = raw.slice(3);
  if (raw.startsWith("whsec_")) raw = raw.slice(6);
  try {
    return Buffer.from(raw, "base64");
  } catch {
    return null;
  }
}
