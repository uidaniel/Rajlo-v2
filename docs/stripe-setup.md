# Stripe setup runbook (test mode)

> What we just built: Stripe Checkout for wallet top-ups. Rider taps
> "Top up" → redirected to Stripe's hosted card form → pays with a
> test card → redirected back to Rajlo → wallet credited via webhook.
>
> Test cards never charge real money. When you eventually switch to a
> real Jamaican bank-direct integration, the surrounding code stays;
> we just swap the gateway internals in `src/lib/wipay.ts`.

## What's wired

| Piece | Where | Status |
|---|---|---|
| Stripe SDK | `package.json` | installed |
| Stripe client + Checkout session creator | `src/lib/wipay.ts` | done |
| Webhook handler with signature verification | `src/app/api/webhooks/stripe/route.ts` | done |
| Deposit creation endpoint | `src/app/api/wallet/deposit/route.ts` | done (unchanged contract, new gateway underneath) |
| Rider wallet UI top-up button | `src/app/rider/wallet/page.tsx` | done (existing UI works as-is) |
| Currency conversion | JMD → USD at `JMD_PER_USD_RATE` env | hardcoded fallback 155 |

## What you need to do on Stripe's side (5 min)

### 1. Confirm the test keys are working

Already pasted into `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_51K…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51K…
```

Add the same two values to **Vercel → Settings → Environment Variables**
(scope: all environments). Redeploy after.

### 2. Create the webhook endpoint in Stripe Dashboard

1. Open **stripe.com** → sign in → make sure you're in **Test mode**
   (toggle in the top-right corner).
2. Left sidebar → **Developers** → **Webhooks**.
3. Click **+ Add endpoint**.
4. **Endpoint URL:** `https://rajlo-v2.vercel.app/api/webhooks/stripe`
   (or your custom domain when you have one).
5. **Description:** `Rajlo wallet deposits` (just for your records).
6. **Events to send:** click "+ Select events" and tick exactly:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
7. Click **Add endpoint**.
8. On the endpoint's page, find the **Signing secret** section. Click
   **Reveal** and copy the value (starts with `whsec_…`).
9. Paste into `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_…
   ```
10. Also paste into Vercel → Settings → Environment Variables → add
    `STRIPE_WEBHOOK_SECRET` → save → redeploy.

### 3. Optional: test locally with Stripe CLI

If you want to test the full flow on `localhost` without deploying:

1. Install Stripe CLI: <https://stripe.com/docs/stripe-cli> (it's a
   one-line install for Mac/Windows/Linux).
2. Run `stripe login` once.
3. In a terminal tab, run:
   ```
   stripe listen --forward-to localhost:3001/api/webhooks/stripe
   ```
4. The CLI prints a local-only signing secret like `whsec_…`. Use
   THAT value as `STRIPE_WEBHOOK_SECRET` for local testing (don't
   confuse it with the Dashboard one — they're different).
5. Keep that terminal open while testing.

## End-to-end smoke test

After webhook secret is set and the site is redeployed:

1. Open `https://rajlo-v2.vercel.app/rider/wallet` (sign in as any rider)
2. Tap **Top up** → enter JMD 1000 → submit
3. Browser redirects to a Stripe-hosted page (`checkout.stripe.com/...`)
4. Use this test card:
   - **Number:** `4242 4242 4242 4242`
   - **Expiry:** any future date (e.g. `12/30`)
   - **CVC:** any 3 digits (e.g. `123`)
   - **ZIP:** any 5 digits (e.g. `10001`)
5. Click **Pay**
6. Stripe redirects you back to `/rider/wallet?deposit_status=processing`
7. Within 5-10 seconds, the wallet auto-polls and the JMD 1000 appears
8. Check Stripe Dashboard → Payments — you should see the charge
   listed (with the deposit_id in metadata)
9. Check Stripe Dashboard → Developers → Webhooks → your endpoint —
   the event log should show `checkout.session.completed` succeeded

If step 7 doesn't happen:
- Open the Stripe Dashboard webhook log — the event row will show
  the response code your endpoint returned. 401 = bad signature
  (env var wrong), 5xx = code error (check Sentry / Vercel logs).
- Open the Vercel function log for `/api/webhooks/stripe` for the
  exact error message.

## Test card variations

Stripe has cards for testing every failure mode. Useful ones for our QA:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Insufficient funds → deposit fails |
| `4000 0027 6000 3184` | 3D Secure required → modal pops up |
| `4000 0000 0000 0341` | Charges but later disputes → for chargebacks |

Full list: <https://docs.stripe.com/testing#cards>

## Withdrawals — current state

For driver withdrawals to bank accounts, the existing flow is preserved:

1. Driver requests withdrawal → wallet debited immediately
2. Admin reviews + approves → status flips to "paid"
3. **No actual money moves** — manual bank transfer is required outside
   the app for now

Stripe Connect Express (which would automate driver payouts) **does
not support payouts to Jamaican bank accounts** as of 2026. When the
JM bank-direct API is ready, we'll wire it into the admin-approve
endpoint at `/api/admin/wallet-withdrawals/[id]`.

## Going live

When you're ready for real money:

1. In Stripe Dashboard, toggle to **Live mode**
2. Get the live publishable + secret keys (start with `pk_live_` and
   `sk_live_` instead of `_test_`)
3. Create a NEW webhook endpoint in Live mode (separate from test)
   pointing at the same `/api/webhooks/stripe` URL
4. Copy the live webhook signing secret
5. Update Vercel env vars (Production scope only — keep test keys in
   Preview/Development if you want)
6. Redeploy
7. Run another end-to-end test with a real card (Stripe takes ~2% +
   $0.30 USD per charge for real transactions)

Important: live Stripe charges are in **USD only** as long as
`JMD_PER_USD_RATE` is set. Stripe will convert if your bank account
is in a different currency. Talk to your accountant about FX handling
before going live with real customers.

## Files to know

- `src/lib/wipay.ts` — the gateway adapter (file kept misnamed for
  git history continuity; contents are Stripe-only)
- `src/app/api/webhooks/stripe/route.ts` — webhook handler
- `src/app/api/wallet/deposit/route.ts` — deposit creation (unchanged contract)
- `src/app/api/wallet/deposit/callback/route.ts` — legacy browser
  redirect target; not used by Stripe flow but kept for any URL
  callers that point at it
- `docs/secret-rotation-runbook.md` — secret rotation guide
- `docs/qa-checklist.md` — end-to-end testing plan
