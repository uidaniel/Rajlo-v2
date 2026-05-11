# Rajlo pre-launch QA checklist

> Work through this with at least one second person (a "rider tester"
> while you act as driver or vice versa). Several flows require two
> live sessions on different devices.
>
> Before starting:
> - The 4 secrets MUST be rotated (Supabase service role, Resend, Maps,
>   VAPID). See the rotation walkthrough.
> - Run the SQL migration `supabase/rides-settlement-migration.sql` —
>   no, you already did this.
> - Deploy the latest code so the matcher / GPS heartbeat / readiness
>   gate are live in production.
> - Use real phone numbers + emails you can actually receive on. Some
>   flows (signup, OTP, push) only verify under real-world conditions.

Use the boxes to track pass/fail. Anything that fails goes into a
"defects" list at the bottom; fix order is your call.

---

## 0. Smoke (5 min)

- [ ] **Landing page loads** — `https://rajlo-v2.vercel.app/` opens, animations play, no broken images.
- [ ] **Privacy + Terms pages load** — `/legal/privacy` and `/legal/terms` render the full text, no placeholders left in body copy.
- [ ] **How it works + fare estimator load** — `/how-it-works`, `/fare-estimator`.
- [ ] **404 page renders properly** for an unknown URL.

## 1. Rider signup → first ride (private) — 20 min

Two people required: one rider, one driver (account already activated).

### A. Signup
- [ ] Open `/auth/rider/signup` in an incognito window.
- [ ] Fill name, email (real address), phone (real number, +1876…), password (≥8 chars).
- [ ] Tap "Create account" → see confirmation email lands in inbox within 1 min.
- [ ] Click the confirmation link → lands on `/rider` (the dashboard).
- [ ] **Expected:** Dashboard shows "Hi {name}", wallet balance 0, "Take your first ride" empty state for history.

### B. Book a private ride
- [ ] On `/rider`, tap "Request a ride" or navigate to `/rider/request`.
- [ ] Enter pickup (use a real address in your parish).
- [ ] Enter dropoff (somewhere 5-10 km away).
- [ ] **Expected:** fare quote shows, map renders both pins, suggested route appears.
- [ ] Increase seats to 2 → fare adjusts.
- [ ] **Expected:** Carpool toggle is NOT visible (intentionally hidden for launch).
- [ ] Try to submit → if wallet is empty, get blocked with "Top up your wallet" 402. Pass: error message is clear.
- [ ] Top up wallet via admin "manual adjust" (we don't have real bank top-up yet) — `/admin/wallets/[userId]/adjust` POST with `kind=admin_credit`.
- [ ] Re-attempt the ride request → success.
- [ ] **Expected:** Lands on `/rider/live-trip`, sees "Looking for a driver…" hero + map with rider's blue dot.

### C. Driver accepts
- [ ] On the second device, log in as an activated driver.
- [ ] Driver dashboard shows incoming ride card in the inbox.
- [ ] Driver receives a **push notification** if the tab isn't in focus.
- [ ] Driver taps Accept → succeeds.

### D. Mid-ride
- [ ] Rider's live-trip page flips to "Driver on the way", shows driver name + plate + ETA.
- [ ] Rider sees **two markers on the map**: their blue dot + the driver's car icon.
- [ ] Driver's car icon **rotates as the driver moves** and **does not clip at any angle**.
- [ ] Driver's marker updates every ~5 seconds even when the driver is stationary (heartbeat).
- [ ] Driver hits "I've arrived" → rider sees arrival push + status flip.
- [ ] Driver hits "Start trip" → status flips to in_progress.
- [ ] Driver hits "Complete" → ride completes, fare deducted from rider wallet, 85% credited to driver wallet, 15% commission column populated.
- [ ] Rider sees completion screen with "Rate your driver" CTA.
- [ ] Rider rates 5 stars → rating persists.

### E. Wallet records
- [ ] Rider's wallet shows the ride_charge transaction with the correct amount.
- [ ] Driver's wallet shows ride_earning at 85% of the fare.
- [ ] Admin can see commission accumulating (query `wallet_transactions` where kind=ride_charge minus ride_earning).

## 2. Driver onboarding → first earning — 30 min

### A. Signup as new driver
- [ ] `/auth/driver/signup` → fill form, email + phone + password.
- [ ] Email confirmation arrives.
- [ ] Lands on `/driver/onboarding`.

### B. Document upload
- [ ] Onboarding form prefilled with name/email/phone from signup.
- [ ] Upload each required document (TA badge, licence, insurance, road licence, fitness, vehicle registration, plate photo, selfie).
- [ ] Each upload shows progress / success state. Network failure on any upload triggers a clear error (try with airplane mode briefly).
- [ ] Expiry date fields work; future date required for renewable docs.
- [ ] Submit application → lands on `/driver/pending`.

### C. Admin verification
- [ ] As admin, open `/admin/drivers` → new driver appears with "needs review" badge.
- [ ] Open the driver's `/admin/verification-detail/[id]` page.
- [ ] View each uploaded document — they open in a new tab via signed URL.
- [ ] Approve → driver gets approval email + push.

### D. First ride
- [ ] New driver lands on `/driver` dashboard after approval.
- [ ] **Driver readiness gate appears** because PWA isn't installed + push not granted.
- [ ] Follow gate's per-platform install steps (iOS: Add to Home Screen; Android: tap Install).
- [ ] After install, gate flips to step 2: "Enable notifications".
- [ ] Tap "Enable notifications" → browser permission prompt → grant → gate disappears.
- [ ] Online toggle now appears. Flip online.
- [ ] **Verify backgrounded warning** — switch to another app for a few seconds, come back. Banner "Rajlo is in the background" should have appeared and disappeared.
- [ ] Wait for a real ride request from a rider tester. Accept it. Complete the flow.
- [ ] Earnings appear in `/driver/earnings`.

### E. Withdrawal
- [ ] Open `/driver/wallet` → shows balance.
- [ ] Tap "Withdraw to bank" → enter bank details + amount ≥ JMD 500.
- [ ] Submit → withdrawal row created, wallet debited immediately.
- [ ] As admin, approve withdrawal at `/admin/wallet-withdrawals`.
- [ ] Driver sees withdrawal status flip to "paid".

## 3. Route taxi end-to-end — 25 min

Requires two people: a rider AND a driver who has a route-taxi session running.

### A. Driver starts a session
- [ ] On the driver dashboard, navigate to `/driver/route-taxi`.
- [ ] Pick a route (e.g. "Half Way Tree → Cross Roads"), pick direction.
- [ ] Tap "Start session" → driver_sessions row created with status=active.
- [ ] **Expected:** driver's current GPS shows on the route map.

### B. Rider hails
- [ ] On the rider device, navigate to `/rider/request`.
- [ ] Pickup + dropoff that match the driver's route (e.g. start somewhere on Half Way Tree, end somewhere on Cross Roads).
- [ ] **Expected:** A "Route Taxi" option appears in the mode picker with the regulated fare.
- [ ] Switch to Route Taxi → tap "Hail next car".
- [ ] **Expected:** Lands on `/rider/route-taxi/live` showing "Notifying drivers on this corridor".
- [ ] Rider's own marker shows on the map.

### C. Driver gets the hail
- [ ] Within 5 seconds, driver sees the new hail in the "pending" bucket on their /driver/route-taxi page.
- [ ] Driver receives a **push notification** (if tab not focused).
- [ ] Driver taps Accept.
- [ ] **Race-safe test:** If two drivers are on the same route, only ONE can accept. The second gets "Another driver just accepted this hail." 409.

### D. Mid-trip
- [ ] Rider's live page flips to "Driver on the way" with driver name/plate.
- [ ] Driver's car icon visible on rider's map, rotating + heartbeating.
- [ ] Driver taps "Picked up" when they collect the rider.
- [ ] Driver taps "Drop off" / "Complete" at the destination.
- [ ] **Expected:** Fare deducted, 85% to driver / 15% commission, hail row stamped with `driver_earnings_jmd` + `commission_jmd`.

## 4. Wallet transfer + OTP — 10 min

- [ ] Rider A initiates a transfer to Rider B at `/rider/wallet/transfer` (or via Send button).
- [ ] Enter B's email + amount ≥ JMD 50.
- [ ] **Expected:** OTP email arrives within 30 sec.
- [ ] Try 4 wrong codes → "X attempts left" message decrements.
- [ ] On the 5th wrong code → transfer cancelled, sender refunded automatically.
- [ ] Re-initiate, enter correct code on first try → recipient's wallet credited.
- [ ] **Rate-limit check:** try to initiate 6 transfers in quick succession → 6th returns 429 "Too many requests".

## 5. Admin flows — 15 min

- [ ] `/admin/drivers` lists every driver, filter by status works.
- [ ] `/admin/users` lists all riders, search works.
- [ ] `/admin/wallets` lists every user's wallet balance.
- [ ] `/admin/transactions` shows aggregate money flow charts (today, week, month).
- [ ] `/admin/verification-detail/[id]` for a specific driver shows their docs + audit log.
- [ ] **Test approval/rejection:** approve a pending driver → email fires, status updates. Reject → driver sees notification + lands on `/driver/pending` with rejection note.
- [ ] **Manual wallet adjustment:** debit JMD 100 from a test account; row shows in their wallet history with kind=admin_debit.

## 6. Safety — 10 min

- [ ] Open `/rider/safety` mid-trip → SOS button visible.
- [ ] Tap SOS → confirmation modal → confirm.
- [ ] **Expected:** SAFETY_OPS_EMAIL gets an alert email with the rider's name + trip context + location.
- [ ] Share trip flow generates a shareable link `/trip/[token]` that opens the live map for the recipient with NO login required.

## 7. Cross-cutting checks — 15 min

### Mobile responsiveness (iPhone Safari + Android Chrome)
- [ ] Hero CTAs don't wrap awkwardly.
- [ ] Forms scroll properly with the keyboard open (iOS doesn't double-scroll).
- [ ] Inputs don't trigger zoom on focus (16px font rule).
- [ ] Mobile sidebar drawer covers the whole screen, no white strip behind.

### Push notifications
- [ ] Real device test: a driver with push enabled receives a buzz when a hail comes in, even if Rajlo is in the background (warning banner shows).
- [ ] Tapping the notification opens the right page (e.g. `/driver/route-taxi`).

### Error paths
- [ ] Disconnect network mid-booking → friendly error, not white screen.
- [ ] Deny location permission → flow falls back to address-only entry, doesn't soft-lock.
- [ ] Open `/rider/live-trip?id=fake-id` → graceful "No active trip" empty state, not a crash.

### Performance
- [ ] Lighthouse audit on `/` (landing) — aim for ≥85 performance, ≥95 accessibility.
- [ ] Slow-3G test (DevTools throttle) — landing still usable, doesn't hang forever.

## Known gaps before public launch (NOT in scope of this QA)

These remain open and need handling separately:

- [ ] **Bank-direct payment integration** — top-ups currently can only be done by admin manual credit. Real bank API integration is pending bank credentials.
- [ ] **SMS OTP** — deferred. All OTP flows are email-only. UI does not offer SMS option.
- [ ] **Sentry error tracking** — not wired yet (waiting on DSN).
- [ ] **Real legal counsel review** — legal pages are reasonable drafts; have a JM-licensed attorney review before public launch.
- [ ] **Native app wrap (Capacitor)** — planned post-beta. Background GPS will only fully work after the wrap.
- [ ] **Rate-limit infrastructure** — currently in-memory per Vercel instance; consider Upstash KV before scaling past ~500 users.

---

## Defects found (fill in as you go)

| # | Flow | What went wrong | Severity | Status |
|---|---|---|---|---|
|  |  |  |  |  |

Severity guide:
- **P0** — blocks core flow (signup, booking, completing a ride, wallet)
- **P1** — degrades UX but a workaround exists
- **P2** — cosmetic / polish

Tackle every P0 before going public.
