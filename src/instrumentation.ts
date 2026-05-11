/**
 * Server-side instrumentation for Rajlo. Wires Sentry into the Node.js
 * and Edge runtimes so server errors / API route failures / proxy
 * errors all flow into the Sentry dashboard.
 *
 * Conventions:
 *   - File MUST sit at `src/instrumentation.ts` (or repo root) — Next.js
 *     auto-discovers it. Don't rename it.
 *   - `register()` runs once when each runtime spins up.
 *   - `onRequestError` is Next 15+'s hook for "any error during a
 *     server-rendered or route-handler request". Sentry's
 *     `captureRequestError` matches that signature exactly.
 *
 * We only ENABLE Sentry in production. In dev, errors print to the
 * console and you see them in your terminal — no need to fill the
 * Sentry dashboard with noise from your own laptop.
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      // Sampling: 10% of transactions for performance monitoring.
      // 100% of errors are always captured regardless.
      tracesSampleRate: 0.1,
      // Send a tagged "environment" so the Sentry UI separates prod
      // events from preview deploys from local.
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      enabled: process.env.NODE_ENV === "production",
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      enabled: process.env.NODE_ENV === "production",
    });
  }
}

/** Next 15+ hook — every request error flows through this. */
export const onRequestError = Sentry.captureRequestError;
