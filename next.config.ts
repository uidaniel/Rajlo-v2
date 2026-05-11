import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* base config — add Next.js options here */
};

/**
 * Sentry wrapper. Notes on what each option does:
 *
 *   - `org` / `project` — match the Sentry dashboard. Used at build
 *     time for source-map upload.
 *   - `silent` — quiet Sentry's CI output unless CI is set (Vercel
 *     sets it, local builds don't).
 *   - `widenClientFileUpload` — uploads source maps for every JS
 *     chunk including dynamically-imported ones. Slightly larger
 *     upload but every stack trace becomes readable.
 *   - `tunnelRoute` — route through `/monitoring` so ad-blockers /
 *     privacy extensions don't drop the requests. Without this,
 *     ~30% of users have errors silently swallowed.
 *   - `sourcemaps.filesToDeleteAfterUpload` — uploads source maps to
 *     Sentry then deletes them from the production bundle. Stack
 *     traces are readable in Sentry, but a curious user inspecting
 *     the page can't grab the original source.
 *
 * Source-map upload requires `SENTRY_AUTH_TOKEN` set on Vercel. If
 * the token isn't there, source maps simply aren't uploaded — Sentry
 * still receives every error, just with minified stack traces. Set
 * up the token at Sentry → Settings → Account → Auth Tokens.
 */
export default withSentryConfig(nextConfig, {
  org: "rajlo",
  project: "rajlo-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    filesToDeleteAfterUpload: [".next/static/**/*.map"],
  },
});
