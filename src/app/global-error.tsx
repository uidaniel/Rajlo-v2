"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

/**
 * Root error boundary — catches anything that bubbles past every
 * page's own `error.tsx`. Required for Sentry to capture React
 * rendering errors (Next.js per-route error boundaries don't
 * propagate to Sentry on their own).
 *
 * Why a separate file: Next.js's `global-error.tsx` REPLACES the
 * `<html>` and `<body>` tags so the root layout's chrome is gone
 * when this renders. That's intentional — when the root layout
 * itself crashed, we can't trust it. The styling here is
 * deliberately minimal for the same reason.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
