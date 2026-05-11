import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { creditWallet } from "@/lib/wallet";
import { verifyStripeWebhook } from "@/lib/wipay";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe sends every payment event to this endpoint. We verify the
 * signature against `STRIPE_WEBHOOK_SECRET`, then react to:
 *
 *   - `checkout.session.completed`     → mark deposit completed, credit wallet
 *   - `checkout.session.async_payment_succeeded` → same (for delayed payments)
 *   - `checkout.session.expired`       → mark deposit cancelled
 *   - `checkout.session.async_payment_failed`    → mark deposit failed
 *
 * This route is the SOURCE OF TRUTH for deposit completion. The
 * browser-redirect /api/wallet/deposit/callback is purely UI — it
 * doesn't credit the wallet. We separate them because:
 *   1. Stripe's signature only verifies against the webhook URL.
 *   2. Browsers can be closed mid-payment; the webhook still fires.
 *   3. Webhooks are retried by Stripe if our endpoint 5xx's, so the
 *      flow is automatically resilient.
 *
 * Idempotency: each deposit_id maps to a single wallet_deposits row.
 * If we receive the same event twice (Stripe does retry on 5xx), the
 * `status !== 'pending'` guard short-circuits.
 *
 * IMPORTANT: this route MUST read `request.text()` BEFORE any other
 * body access — Stripe verifies the signature over the exact raw
 * bytes, and JSON.parse + re-stringify changes byte order on some
 * keys. We never call `request.json()` directly here.
 */

// Disable Next.js's automatic body-parsing intercept — though for App
// Router this is mostly a no-op since route handlers don't do that
// anyway. Calling text() always gives us the raw body.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const event = verifyStripeWebhook(rawBody, signature);
  if (!event) {
    // Either the signature is wrong or the webhook secret isn't
    // configured. Either way we reject — never credit a wallet from
    // an unverified webhook.
    return NextResponse.json(
      { error: "Invalid Stripe webhook signature" },
      { status: 401 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "checkout.session.expired":
      return handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
    case "checkout.session.async_payment_failed":
      return handleCheckoutFailed(event.data.object as Stripe.Checkout.Session);
    default:
      // We acknowledge every event so Stripe doesn't retry. Unknown
      // event types just pass through — Stripe sends dozens we don't
      // care about (payment_intent.*, charge.*, customer.*, etc).
      return NextResponse.json({ ok: true, ignored: event.type });
  }
}

/**
 * Mark a successful deposit completed + credit the wallet.
 *
 * Pulls the deposit_id from session.metadata (we set it when we
 * created the session in src/lib/wipay.ts). If the metadata is
 * missing or the deposit row isn't pending, we short-circuit so
 * we never double-credit.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<NextResponse> {
  const depositId = session.metadata?.deposit_id;
  if (!depositId) {
    // No deposit_id means this Checkout wasn't created by us. Log
    // and ack so Stripe doesn't retry — but don't credit anyone.
    console.error(
      "stripe-webhook: checkout.session.completed without deposit_id metadata",
      { sessionId: session.id },
    );
    return NextResponse.json({ ok: true, ignored: "no_metadata" });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { data: deposit } = await supabase
    .from("wallet_deposits")
    .select("id, user_id, amount_jmd, status")
    .eq("id", depositId)
    .maybeSingle();

  if (!deposit) {
    console.error("stripe-webhook: deposit row not found", { depositId });
    // Ack so Stripe stops retrying — the deposit is gone, we can't
    // recover by retrying.
    return NextResponse.json({ ok: true, ignored: "deposit_not_found" });
  }

  // Idempotent: already credited → just ack.
  if (deposit.status !== "pending") {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  const credit = await creditWallet(
    supabase,
    deposit.user_id,
    deposit.amount_jmd,
    "deposit",
    {
      depositId: deposit.id,
      description: `Wallet top-up · JMD ${deposit.amount_jmd.toLocaleString(
        "en-JM",
      )}`,
      metadata: {
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
      },
    },
  );

  if (!credit.ok) {
    console.error("stripe-webhook: creditWallet failed", {
      depositId,
      error: credit.error,
    });
    // Return 500 so Stripe retries — the deposit row stays pending
    // and the next retry will pick up where we left off.
    return NextResponse.json({ error: credit.error }, { status: 500 });
  }

  await supabase
    .from("wallet_deposits")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      gateway_reference: session.id,
    })
    .eq("id", deposit.id);

  return NextResponse.json({ ok: true });
}

async function handleCheckoutExpired(
  session: Stripe.Checkout.Session,
): Promise<NextResponse> {
  return markDepositTerminal(session, "cancelled");
}

async function handleCheckoutFailed(
  session: Stripe.Checkout.Session,
): Promise<NextResponse> {
  return markDepositTerminal(session, "failed");
}

async function markDepositTerminal(
  session: Stripe.Checkout.Session,
  status: "failed" | "cancelled",
): Promise<NextResponse> {
  const depositId = session.metadata?.deposit_id;
  if (!depositId) {
    return NextResponse.json({ ok: true, ignored: "no_metadata" });
  }
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }
  await supabase
    .from("wallet_deposits")
    .update({ status })
    .eq("id", depositId)
    .eq("status", "pending"); // only flip pending → terminal
  return NextResponse.json({ ok: true });
}
