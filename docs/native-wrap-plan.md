# Rajlo native wrapper plan — Capacitor

> Status: not started. This is the plan to wrap the existing Next.js
> web app as native iOS + Android apps via Capacitor, once the web
> PWA beta has validated the product (target: 1-2 months of web beta
> first, then start this work).

## Why Capacitor

Capacitor (by the Ionic team) loads the Rajlo web build inside a
native WebView wrapped in a real iOS / Android app shell, with a
plugin layer that exposes native APIs to JavaScript. The existing
Next.js code runs unchanged. We add capabilities that the web simply
cannot provide:

- **Background GPS** — driver location keeps streaming when the screen
  locks or another app is on top. Web cannot do this.
- **Native push** (APNs on iOS, FCM on Android) — more reliable than
  web push, no "must install PWA first" dance on iOS.
- **Real app icon + App Store / Play Store presence** — trust signal,
  discoverability.
- **Native lifecycle** — Rajlo wakes properly from a push notification,
  resumes state, integrates with the OS share sheet etc.

## What stays the same

- Every Next.js page, every Supabase query, every wallet/fare/matcher
  endpoint — unchanged. The WebView loads the same URLs.
- The web app at rajlo.com keeps working for desktop / casual users.
- Existing web push subscriptions keep delivering — we add native push
  alongside, not as a replacement, so both channels work.

## Prerequisites — get these in place first

1. **Apple Developer Program** — $99/yr, registered under **Rajlo
   Limited** (the legal entity). Personal Apple ID won't cut it for a
   commercial app. Sign up at developer.apple.com.
2. **Google Play Developer** — $25 one-time, same Rajlo Limited
   registration. Sign up at play.google.com/console.
3. **Production domain configured** — apps point to `https://rajlo.com`
   (or wherever the production URL lives). The wrapper just loads
   that URL inside the WebView.
4. **Finalised privacy policy** — Apple specifically requires a
   "background location" clause that explains why the app collects
   location when not in foreground. The existing /legal/privacy text
   needs one targeted addition (see `docs/native-wrap-privacy-clause.md`
   when this work starts).
5. **App icons + splash screens** — Capacitor needs 1024×1024 source
   icon + 2732×2732 splash. We can generate from `Rajlo white.svg`.

## Plugins we'll need

| Plugin | Purpose |
|---|---|
| `@capacitor/geolocation` | Foreground GPS (replaces browser API in the WebView) |
| `@capacitor-community/background-geolocation` | True background location for drivers — the headline feature |
| `@capacitor/push-notifications` | APNs on iOS, FCM on Android |
| `@capacitor/local-notifications` | Show alerts even when no server push (e.g. ride request timer) |
| `@capacitor/app` | Lifecycle events (resume, pause, deep links from push) |
| `@capacitor/preferences` | Native settings storage if needed |
| `@capacitor/status-bar` | Set status bar colour to brand red |
| `@capacitor/splash-screen` | Branded launch screen |
| `@capacitor/network` | Detect offline state for better error UX |

## Architecture sketch

```
┌─────────────────────────────────────────────────┐
│  iOS app / Android app shell (Capacitor)        │
│  ┌───────────────────────────────────────────┐  │
│  │  WebView                                  │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Rajlo (Next.js at rajlo.com)       │  │  │
│  │  │  - same React, same pages           │  │  │
│  │  │  - calls Capacitor.* APIs when      │  │  │
│  │  │    running natively (feature        │  │  │
│  │  │    detection picks web fallback     │  │  │
│  │  │    when running in browser)         │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
│  Native plugins:                                │
│   - Background geolocation                      │
│   - Push (APNs / FCM)                           │
│   - Status bar / splash                         │
└─────────────────────────────────────────────────┘
```

Feature detection in our code:

```ts
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform()) {
  // use @capacitor/geolocation with background mode
} else {
  // current navigator.geolocation flow (unchanged)
}
```

This pattern preserves the web build — none of the existing code
breaks.

## Step-by-step rollout

### Phase 1: Project skeleton (2-3 days)
1. `npm install @capacitor/core @capacitor/cli`
2. `npx cap init Rajlo com.rajlo.app --web-dir=.next`
3. `npx cap add ios` and `npx cap add android`
4. Configure `capacitor.config.ts` to point the WebView at the
   production URL (or local dev tunnel for testing)
5. Verify the app builds + runs on a real iOS simulator + Android
   emulator showing the existing web UI

### Phase 2: Native push (3-5 days)
1. Install `@capacitor/push-notifications`
2. Create APNs key in Apple Developer portal; register FCM project
3. Add a server endpoint `/api/me/push/native-subscribe` that stores
   the native device token (similar to existing `/api/push/subscribe`
   for web push)
4. Update `src/lib/push.ts` server-side helper to fan out to BOTH web
   push subscriptions AND native push tokens for the same user
5. Test end-to-end: hail a route taxi → driver's locked phone rings

### Phase 3: Background GPS (1 week, the hard part)
1. Install `@capacitor-community/background-geolocation`
2. Add iOS background-location mode in Info.plist + Apple's required
   "When In Use" → "Always" upgrade prompt flow
3. Add Android foreground service for continuous tracking (required
   on Android 9+)
4. Rewrite `useRidePosition` + `useFleetBroadcaster` to use the
   plugin when running natively, falling back to web when in
   browser
5. Test: lock phone, drive around the block, verify pings still arrive

### Phase 4: Polish (3-5 days)
1. Branded splash screen + app icons (generate from logo SVG)
2. Status bar tint matching Rajlo red
3. Deep link handling: tapping a push notification should open the
   right page (e.g. `/driver/route-taxi?hail=xxx`)
4. Native share sheet integration for the "share my trip" feature

### Phase 5: App Store + Play Store submission (2-4 weeks calendar)
1. Apple App Store: create app listing, screenshots, description,
   privacy policy URL, fill in App Privacy questions
   - **Background location justification** — be specific: "Drivers
     use this app to accept rides while moving. Location is shared
     with riders only during active trips."
2. Google Play: similar listing, prominent disclosure for background
   location
3. First review usually takes 24-72 hours
4. Expect 1-2 rounds of "please clarify X" — common, not a problem

## Common rejection reasons and how to pre-empt

| Reason | Pre-empt |
|---|---|
| Background location lacks justification | Add explicit rationale screen on first launch; quote it in App Privacy |
| Privacy policy URL is placeholder | Use the real /legal/privacy page (already drafted) |
| WebView wrapper too thin (Apple 4.2) | Add native-only features visible to reviewer: splash, push, biometric login, etc. |
| Crash on minimum iOS / Android version | Specify minimum versions explicitly; test on those targets |
| Permissions requested without clear use | Each permission needs an inline rationale before the OS prompt |

## Estimated cost + timeline

| Item | Cost / time |
|---|---|
| Apple Developer | $99/yr |
| Google Play | $25 one-time |
| Engineer time (Capacitor experienced) | 2-3 weeks |
| Engineer time (first-time with Capacitor) | 4-6 weeks |
| App Store review cycles | 1-3 weeks calendar (incl. resubmissions) |
| **Total to ship native apps** | **~$125 + 4-9 weeks of work** |

## When to start

Start Capacitor work when **all four** are true:
1. Web PWA has 50+ active drivers using it daily and giving feedback.
2. Core features (route-taxi matcher, GPS heartbeat, wallet, ratings,
   safety) are stable and not changing weekly.
3. Rajlo Limited is registered as a company in Jamaica.
4. Privacy policy + ToS have been reviewed by JM counsel.

Until those are all true, every Capacitor week burned now is a week
that has to be redone later when the underlying web app shifts.

## Open questions to settle before kickoff

- **One app or two?** Rajlo Driver + Rajlo Rider as separate apps in
  the stores, or one unified Rajlo app with both portals inside?
  Most rideshares do separate (cleaner App Store description, less
  cognitive load). Recommendation: separate, but build them from the
  same Capacitor project (two `cap add` configurations).
- **Production URL vs bundled HTML?** Capacitor can either load
  `https://rajlo.com` live OR bundle a static export and run offline.
  Live URL is simpler — every web deploy is also an app update with
  no resubmission. Recommendation: live URL for speed of iteration,
  fall back to bundled if Apple complains.
- **Auto-update strategy** — Capacitor supports OTA updates via
  Capgo or Appflow. Worth it once we have >500 users. Skip until then.
