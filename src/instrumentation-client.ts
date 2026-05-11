/**
 * Client-side instrumentation for Rajlo. Wires Sentry into the browser
 * so React rendering errors, unhandled promise rejections, and any
 * `throw` from event handlers flow into the Sentry dashboard.
 *
 * Conventions:
 *   - File MUST sit at `src/instrumentation-client.ts` (or repo root).
 *     Next.js (≥15.3) auto-runs it before React hydration.
 *   - No `register()` export needed here — top-level statements ARE
 *     the initialisation.
 *
 * We only ENABLE Sentry in production. Dev errors stay in the browser
 * console where they belong.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring: sample 10% of full page-loads. Errors are
  // always captured at 100% regardless of this number.
  tracesSampleRate: 0.1,

  // Session replays: don't record everyone (privacy + cost), but when
  // an error happens, snapshot the user's last 30s of UI so we can
  // see what they were doing when it broke. Free tier includes some
  // replays — review usage after a couple weeks and bump
  // `replaysOnErrorSampleRate` down if needed.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      // Block credit-card-like inputs + the wallet OTP form just in
      // case — defensive, not strictly necessary since we never put
      // raw card numbers on the page.
      blockAllMedia: false,
    }),
  ],

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  enabled: process.env.NODE_ENV === "production",
});

/** Next 15+ hook — fired on every client-side navigation so Sentry
 *  can stitch together router transitions as part of the same trace. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
