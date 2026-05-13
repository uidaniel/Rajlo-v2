# Rajlo Driver — Play Store compliance checklist

What's done in code vs. what you need to do in Play Console + Firebase
+ on your own infrastructure before submitting.

## ✅ Code-side (already shipped)

### Technical requirements
- **Target SDK 36** (`android/variables.gradle`) — comfortably above
  Play Store's 2026 floor of API 34.
- **Min SDK 24** — covers 97%+ of in-use Android devices.
- **64-bit support** — Capacitor 7 ships ARM64 + x86_64 binaries by
  default; nothing to configure.
- **Hardware acceleration + large heap** declared on the application
  in `AndroidManifest.xml` for GPU compositing + bigger WebView memory.

### Permissions (all declared + justified per Google's runtime model)
- `INTERNET` — load the WebView contents.
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` / `ACCESS_BACKGROUND_LOCATION`
  — required for trip tracking. **You'll need to justify
  background location** in Play Console with a 30-second video
  demonstrating the use case (driver locks phone mid-trip → app
  keeps streaming GPS via the foreground service notification).
- `POST_NOTIFICATIONS` — Android 13+ requirement, requested at
  runtime via the readiness gate.
- `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` — voice notes in chat.
- `CAMERA` — in-chat photo capture.
- `READ_MEDIA_IMAGES` + `READ_EXTERNAL_STORAGE` (Android 12-) —
  gallery picker for chat attachments.
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` — required
  by Android 14+ for the background-geolocation foreground service.
- `WAKE_LOCK` — keeps CPU alive during GPS fixes on aggressive
  battery-saving OEMs.

### Native UX (the "real app" feel)
- **Hardware Android back button** intercepted by Capacitor —
  browser-back if there's history, exit app if at the driver
  dashboard root.
- **Bottom navigation bar** (Home / Trip / Earnings / History / Me)
  visible only inside the Capacitor app. The web continues using
  the existing sidebar.
- **Page transitions** — 180ms slide-fade between routes.
- **Haptic feedback** on every meaningful tap (`haptics.tap()`,
  `.medium()`, `.success()`, `.warn()`).
- **Smooth-scroll + no overscroll bounce propagation** via
  `overscroll-behavior: contain`.
- **No text-selection cursor on UI chrome** — buttons + nav don't
  fire long-press text-select.
- **No default tap-highlight** — branded ripple only.
- **Splash screen hides on React mount** (instead of waiting 1.5s
  ceiling) so perceived cold-start drops by 1-2 seconds.

### Required for a rideshare app specifically
- Background-location consent: re-prompts on every cold start via
  `useLocationViolationMonitor`.
- Foreground-service notification: shows `"Rajlo is sharing your
  location for an active trip"` while a trip is in flight.
- 2-strike auto-deactivation if a driver disables location mid-trip
  (server enforces, admin can clear via `/admin/violations`).

---

## ❌ Things YOU need to set up before submission

These are infrastructure / policy items the code can't auto-handle.

### 1. Play Console (one-time, ~$25 lifetime)
1. **Create a Google Play developer account** at
   `play.google.com/console/signup` ($25 one-time fee).
2. **Verify your identity** — government ID + phone number. Takes
   2-7 days.
3. **Set up Play App Signing** — Play Console manages your signing
   key. Generate an upload key in Android Studio
   (`Build → Generate Signed Bundle/APK`) and save it somewhere
   safe (you can never recover it).

### 2. Privacy Policy (legally required)
You must host a privacy policy on a public URL before submitting.
Required content for a rideshare app:
- What you collect (location, payment info, contact info)
- Why you collect it (matching, payouts, support)
- Who you share it with (Supabase, Firebase, Google Maps)
- How long you retain it
- Contact info for data requests (GDPR-style)

Suggested URL: `https://rajlo.com/legal/privacy` once the domain is
live. Use a template generator (TermsFeed, Iubenda) and customize
for Jamaica + your specific data flows. Lawyer review recommended
before public launch.

### 3. Data Safety questionnaire (Play Console)
For each data type Rajlo collects, declare:
- Collection / sharing status
- Purpose (account management, app functionality, analytics, etc.)
- Whether the data is encrypted in transit (yes — HTTPS)
- Whether the user can request deletion (yes — they can delete
  their account from `/rider/settings`)

Items you'll need to declare:
- **Location (precise + approximate)** — for driver matching and
  trip tracking.
- **Photos** — chat attachments.
- **Audio** — voice notes in chat.
- **Name + Email** — account info.
- **Phone number** — contact between rider/driver.
- **Payment info** (when wired) — top-ups + payouts.

### 4. Background-location justification video
Play Store reviewers will ask. Record a 30-60s screen recording
showing:
1. Driver toggles online → location prompt appears
2. Driver accepts a trip → trip starts
3. Driver locks their phone → notification stays visible
4. Rider sees the driver's marker still moving on their map
5. Trip completes → notification dismisses

Upload to Play Console under "App content → Sensitive permissions".

### 5. Store listing assets
- **App icon** — 512×512 PNG (we have the white wordmark on red).
- **Feature graphic** — 1024×500 banner for the store page.
- **Phone screenshots** — minimum 2, recommended 4-8. Show: sign-in,
  dashboard with ride request, active trip with map, earnings
  page, safety modal.
- **Short description** — 80 chars: *"Drive with Rajlo — Jamaica's
  trusted rideshare platform."*
- **Full description** — 4000 chars; talk about red-plate verified
  drivers, transparent JMD pricing, background safety monitoring.

### 6. App Bundle (.aab) upload
1. In Android Studio: **Build → Generate Signed Bundle / APK →
   Android App Bundle** (NOT APK — Play Store wants AAB).
2. Sign with your upload key.
3. Upload to Play Console → Internal Testing first.
4. Add yourself + a few trusted drivers as testers.
5. Test the install + sign-in flow end-to-end from the Play Store
   download link.

### 7. Review + rollout
- **Internal testing** → no review, up in minutes.
- **Closed testing** (~20 testers) → review in <24h typically.
- **Open testing** → review in 1-3 days.
- **Production** → first submission reviewed in 1-7 days; subsequent
  releases usually <24h.

For Rajlo, the realistic path: internal test for a week → closed
test with 10-20 drivers → production once you have ratings to
support it.

### 8. Refusable / rejection risks specific to rideshare apps

| Risk | How we mitigate |
|---|---|
| "Just a webview wrapper" rejection | Native plugins (background GPS, push, haptics, status bar, splash) prove substantial native integration — the bar passes. |
| Background location misuse | Foreground-service notification + clear in-app explanation in `verify-on-web` / readiness gate. Justification video closes it out. |
| Privacy policy missing or stale | Host one at `rajlo.com/legal/privacy` before submission. |
| Crash on first launch | Sentry catches anything; test on fresh-install device once before submission. |
| Misleading description | Don't promise features you haven't shipped (e.g., don't say "Apple Pay" if you haven't wired it). |

---

## When to submit

I'd hold off on Play Store production until:
1. The cookie persistence fix has been verified working (you've
   sign-in-and-quit-tested 10+ times without re-auth)
2. End-to-end native push is verified (FCM tokens land in
   `push_subscriptions`, you see heads-up notifications on the
   phone)
3. The location violation flow has been tested at least once
   (toggle location off mid-trip → vibration + warning)
4. The bottom nav + back button feel right on your phone

Internal testing track is fine to use during this stabilization
period — you can iterate without burning store-review cycles.
