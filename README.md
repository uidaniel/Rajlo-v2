# Rajlo

Jamaica's rideshare platform — verified red-plate drivers, transparent parish-based pricing, fully cashless wallet, real-time tracking, and route-taxi mode for traditional Jamaican hailing routes.

This repository contains the full Rajlo product: the web app (rider portal, driver portal, admin console, marketing site), the public API, and the native driver app for Android (with iOS planned).

---

## What's inside

Rajlo runs as a single Next.js codebase serving four audiences from one deploy:

- **Rider portal** — `/rider/*` — request rides, wallet, history, safety toolkit, route-taxi
- **Driver portal** — `/driver/*` — onboarding, verification, live trip console, earnings, wallet, route-taxi sessions
- **Admin console** — `/admin/*` — ops dashboards, verification queue, live trips, safety officers, ride monitoring, wallet adjustments
- **Marketing + auth** — `/`, `/auth/*`, `/contact`, `/help`, `/how-it-works`, `/fare-estimator`, `/download`

On top of that, the **driver native app** wraps the live `/driver` portal in a Capacitor WebView so we get background GPS, native push notifications, and Play Store / App Store distribution while still shipping product updates through the same Next.js codebase.

### Two ride engines

- **Private ride** — solo + carpool, parish-based fare, fully cashless via the in-app wallet
- **Route taxi** — traditional Jamaican fixed-route hailing, fare anchored to the Transport Authority 2023 fare schedule (`round10(113 + km × 7.00)`)

### Safety features

- 5-phase safety system: manual SOS, auto unusual-stop, off-route detection, safety-officer dashboard, per-alert chat
- **Verify-Your-Ride** — opt-in 4-digit PIN at pickup (driver must enter it before the trip starts; 3 strikes auto-cancels)
- Driver location-violation reporting + 2-strike auto-deactivation
- Trusted contacts + automatic trip-share

### Payments

- In-app wallet (top-up, ride payment, driver earnings, withdrawals)
- QR Pay — driver charges rider directly via QR
- 100% cashless — no cash code anywhere in the codebase by design

---

## Stack

| Layer | What we use |
| --- | --- |
| Framework | **Next.js 16.2.1** (App Router, React 19.2) — note: this is a new-enough Next that some APIs differ from older releases; see `AGENTS.md` |
| Database / auth | **Supabase** (Postgres + RLS + Realtime + Storage + Auth) |
| Hosting | **Vercel** (auto-deploys from `main`) |
| Styling | **Tailwind CSS v4** + brand fonts (self-hosted Avenir Heavy + Kollektif) |
| Animations | **Motion (motion.dev)** |
| Maps | **Google Maps JavaScript SDK** + Directions API |
| Push | **web-push** for the web rider portal · **Firebase Admin SDK / FCM** for the native driver app |
| Error tracking | **Sentry** (web + edge + server) |
| Native shell | **Capacitor 8** with `@capacitor-community/background-geolocation` |
| Payments rails | Bank-direct API (planned) — no third-party processor |

---

## Repository layout

```
Rajlo-v2/
├── src/
│   ├── app/                   # Next.js App Router pages + API routes
│   │   ├── api/               # Server routes — rider, driver, admin, auth, etc.
│   │   ├── rider/             # Rider portal pages
│   │   ├── driver/            # Driver portal pages
│   │   │   ├── (portal)/      # Activated-driver routes
│   │   │   └── onboarding/    # Pre-activation flow
│   │   ├── admin/             # Admin console
│   │   ├── auth/              # Sign-in / sign-up / password reset
│   │   ├── download/          # Public APK landing page
│   │   └── ...                # Marketing pages (/, /how-it-works, /contact, /help)
│   ├── components/            # Shared components (MapView, dialogs, drawer, bottom nav, brand logo)
│   ├── lib/                   # Business logic — fare engine, ride expiry, carpool matcher, push, wallet, native bridge, etc.
│   └── proxy.ts               # Subdomain split (rider./driver./admin.) — dormant until DNS flip
├── public/                    # Static assets, brand SVGs, fonts, manifest, rajlo-driver.apk
├── assets/                    # Source PNGs for @capacitor/assets icon + splash generation
├── capacitor-shell/           # Offline fallback HTML shown if WebView can't reach Vercel
├── capacitor.config.ts        # Native shell config (bundle id, splash, status bar)
├── android/                   # Generated Android project (gradle, AndroidManifest, resources)
├── supabase/                  # SQL migrations — run idempotently in the Supabase SQL editor
├── scripts/                   # Standalone tooling (vapid keypair gen, fare-engine verifier, TA route parser)
├── docs/                      # Runbooks and checklists (see below)
├── sentry.*.config.ts         # Sentry edge + server config
└── next.config.ts             # Wrapped by withSentryConfig
```

---

## Local development

```bash
npm install
cp .env.example .env.local      # populate the keys below
npm run dev                     # http://localhost:3000
```

### Required environment variables

| Key | Used by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | From Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public; safe in browser |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypasses RLS — never expose to browser |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | client | Web Maps SDK key; restrict by referrer |
| `GOOGLE_MAPS_SERVER_KEY` | server | Directions API key; restrict by IP |
| `SENTRY_AUTH_TOKEN` | build (Vercel) | Source-map upload only; optional in dev |
| `RESEND_API_KEY` | server | Transactional email |
| `WEB_PUSH_VAPID_PUBLIC_KEY` / `WEB_PUSH_VAPID_PRIVATE_KEY` / `WEB_PUSH_VAPID_SUBJECT` | client + server | Web push; generate with `npm run generate-vapid` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | server | FCM push for native driver app |

### Supabase setup

1. Create a Supabase project.
2. In **SQL Editor**, run `supabase/schema.sql` first.
3. Run each `supabase/*-migration.sql` file in date order — they're all idempotent (safe to re-run).
4. Migrations cover: ride lifecycle, carpool matching, route-taxi, wallets, settlements, push subscriptions, safety alerts, ratings, safety officers, off-route detection, driver violations, Verify-Your-Ride PIN, and more.

---

## Native — Android driver app

The driver app is a Capacitor wrapper that loads the live `/driver` portal in a WebView. Native plugins handle the things a browser can't: background GPS, push notifications, splash, status bar, haptics.

```bash
# After cloning + npm install
npx cap sync android                                 # copy native plugins + capacitor config
cd android
./gradlew assembleDebug --no-daemon --no-parallel    # build debug APK
# APK ends up in android/app/build/outputs/apk/debug/app-debug.apk
```

To install on a connected device:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.rajlo.driver -c android.intent.category.LAUNCHER 1
```

Or just `npx cap open android` to open Android Studio.

The pre-built debug APK is published at **[`/rajlo-driver.apk`](https://rajlo-v2.vercel.app/rajlo-driver.apk)** — share `https://rajlo-v2.vercel.app/download` for the install-with-instructions landing page.

**Runbook:** `docs/capacitor-driver-runbook.md` covers every step including the Windows Defender exclusion that's required for Gradle to not file-lock during builds.

---

## Native — iOS driver app (planned)

Capacitor supports iOS but the build only runs on macOS. The plan:

1. Apple Developer Program enrollment (US$99/yr)
2. `npx cap add ios` — scaffolds the iOS project (works on any OS, including Windows)
3. Generate iOS icon + splash from `assets/icon-only.png` via `@capacitor/assets`
4. Configure `Info.plist` permissions (mirrors the Android `AndroidManifest.xml`)
5. APNs auth key in Firebase + Apple Developer portal — FCM routes Android and iOS through the same server code
6. Build on a Mac (own / cloud Mac / Codemagic CI), submit to TestFlight, then App Store

Bundle id will be `com.rajlo.driver` to match Android.

---

## Production deployment

The web app deploys to **Vercel** on push to `main`. The native app loads `https://rajlo-v2.vercel.app/driver` (will move to `driver.rajlo.com` at launch — DNS flip only, code already supports both via `src/proxy.ts`).

Source maps are uploaded to Sentry at build time when `SENTRY_AUTH_TOKEN` is set on Vercel.

---

## Documentation

| Doc | What it covers |
| --- | --- |
| `docs/capacitor-driver-runbook.md` | Full Android build / sync / install + troubleshooting |
| `docs/native-wrap-plan.md` | Architecture decisions for the native shell |
| `docs/play-store-compliance.md` | Play Store submission checklist |
| `docs/qa-checklist.md` | Pre-release QA pass |
| `docs/subdomain-launch-checklist.md` | DNS + proxy flip plan |
| `docs/secret-rotation-runbook.md` | How to rotate VAPID / Supabase / Firebase keys |
| `AGENTS.md` | Notes for contributors on this version of Next.js |

---

## Brand

Source assets live in `public/`:

- `Rajlo main logo.svg` — full-colour wordmark (Rajl black + o red)
- `Rajlo Black.svg` / `Rajlo white.svg` — mono variants
- `assets/icon-only.png` — the "O" mark, used to generate native icons + splash

Primary red: **`#f10100`** · App black: **`#111906`** · White: `#ffffff`
Fonts: **Avenir Heavy** (display) + **Kollektif** (eyebrow / accents) + **Inter** (body/fallback).

In-code reference: `src/components/logo.tsx` renders the canonical wordmark + `<LogoIcon>` mark from the official path data.

---

## License

Proprietary. © Rajlo. Not open source — internal repository.
