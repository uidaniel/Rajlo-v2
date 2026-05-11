/**
 * Payment gateway adapter — currently Stripe.
 *
 * The file is still named `wipay.ts` for git-history continuity (every
 * caller imports `initiateDeposit` and `verifyCallbackSignature` from
 * here). The exported function shapes are gateway-agnostic, so swapping
 * Stripe for the eventual bank-direct integration is a one-file change.
 *
 * Currency note: Stripe doesn't support JMD as a presentment currency,
 * so we charge in USD via a fixed `JMD_PER_USD_RATE` env. The wallet
 * still records the JMD amount; only the line item on Stripe's hosted
 * page is in USD. Test mode charges look realistic ($6.45 for JMD 1000
 * at 155:1) without us writing a real FX integration.
 *
 * Webhook signing: Stripe sends an HMAC signature in the
 * `stripe-signature` header. We verify it server-side in
 * `/api/webhooks/stripe` using the official SDK helper.
 */

import Stripe from "stripe";

/** Lazy-init the Stripe client so missing keys don't break module load
 *  during dev — same pattern as our APP_URL resolver in email-render.
 *  We deliberately do NOT pin an explicit `apiVersion`; the SDK
 *  defaults to the version pinned to your Stripe account, which is
 *  what every Stripe doc + dashboard reference assumes anyway. */
let stripeClient: Stripe | null = null;
export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (test key from " +
        "the Stripe Dashboard) and restart the dev server.",
    );
  }
  stripeClient = new Stripe(key);
  return stripeClient;
}

export type InitiateDepositArgs = {
  /** Internal wallet_deposits.id — encoded as Stripe metadata so the
   *  webhook can reconcile back to our row. */
  depositId: string;
  /** Amount in JMD whole units (no cents). */
  amountJmd: number;
  /** Email shown on Stripe's hosted page + receipts. */
  email: string;
  /** Display name on Stripe's hosted page (helps reduce fraud flags). */
  customerName: string;
  /** Origin (https://rajlo-v2.vercel.app) — used to build the return URLs. */
  origin: string;
};

export type InitiateDepositResult =
  | { ok: true; redirectUrl: string; gatewayReference: string }
  | { ok: false; error: string };

/**
 * Create a Stripe Checkout Session for a wallet top-up and return the
 * hosted-page URL for the client to redirect to.
 *
 * Stripe Checkout = hosted by Stripe, so PCI scope on Rajlo is minimal
 * — card numbers never touch our servers. After payment, Stripe POSTs
 * to /api/webhooks/stripe (which credits the wallet) AND redirects the
 * user back to /rider/wallet for the UI confirmation.
 */
export async function initiateDeposit(
  args: InitiateDepositArgs,
): Promise<InitiateDepositResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      error:
        "Payments aren't configured — set STRIPE_SECRET_KEY in the server environment.",
    };
  }

  const rate = Number(process.env.JMD_PER_USD_RATE ?? "155");
  if (!Number.isFinite(rate) || rate <= 0) {
    return {
      ok: false,
      error: "JMD_PER_USD_RATE env is invalid — expected a positive number.",
    };
  }
  // Convert JMD → USD cents. Round up so we never under-charge.
  const usdCents = Math.max(
    50, // Stripe's $0.50 minimum charge
    Math.ceil((args.amountJmd / rate) * 100),
  );

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: args.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: usdCents,
            product_data: {
              name: `Rajlo wallet top-up`,
              description: `JMD ${args.amountJmd.toLocaleString("en-JM")} for ${args.customerName}`,
            },
          },
        },
      ],
      // Metadata is what links the Stripe transaction back to our
      // deposit row. The webhook handler reads `deposit_id` and uses
      // it to mark the right wallet_deposits row completed.
      metadata: {
        deposit_id: args.depositId,
        amount_jmd: String(args.amountJmd),
      },
      // On success: hand the user back to the wallet page. Note that
      // the webhook (firing in parallel) is what actually credits the
      // wallet — the redirect is just for UX. The page will show a
      // "processing" toast and the new balance will appear within a
      // few seconds once the webhook lands.
      success_url: `${args.origin}/rider/wallet?deposit_id=${encodeURIComponent(args.depositId)}&deposit_status=processing&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${args.origin}/rider/wallet?deposit_id=${encodeURIComponent(args.depositId)}&deposit_status=cancelled`,
    });

    if (!session.url) {
      return { ok: false, error: "Stripe didn't return a checkout URL." };
    }

    return {
      ok: true,
      redirectUrl: session.url,
      gatewayReference: session.id,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    return { ok: false, error: msg };
  }
}

/**
 * Verify a Stripe webhook signature against the raw body and the
 * configured webhook signing secret.
 *
 * Returns the parsed Stripe event on success, or null on failure (bad
 * signature, missing secret, malformed body). Callers should 401 on
 * null — never trust unverified webhooks.
 *
 * Why not just constant-time compare HMAC like before: Stripe's
 * signature scheme includes a timestamp and tolerates replay-window
 * config, so we delegate to their SDK helper instead of rolling our
 * own.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;
  try {
    return getStripeClient().webhooks.constructEvent(
      rawBody,
      signatureHeader,
      secret,
    );
  } catch {
    return null;
  }
}

/**
 * Legacy alias kept so the existing /api/wallet/deposit/callback
 * endpoint compiles without a rename. The callback endpoint is now
 * just the browser-redirect target (Stripe webhooks go to
 * /api/webhooks/stripe with proper signature verification), so this
 * function permissively returns true — the redirect doesn't carry
 * sensitive state, only a deposit_id that gets validated against the
 * DB row.
 */
export function verifyCallbackSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  void rawBody;
  void signatureHeader;
  // The browser-redirect target doesn't need signature verification —
  // it just lands the user on the wallet UI. The webhook handler in
  // /api/webhooks/stripe is where the real signature check happens.
  return true;
}
