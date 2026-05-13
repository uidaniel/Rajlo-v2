"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";

/**
 * Driver portal access gate. Mounted inside the (portal) layout so it
 * runs on every protected driver page (dashboard, history, earnings,
 * etc.) but NOT on /driver/onboarding, /driver/pending, /driver/download-app,
 * or /driver/verify-on-web (those are outside (portal)).
 *
 * Policy:
 *   web        + verified  → render the portal as normal
 *   web        + unverified → render the portal (drivers complete
 *                              onboarding from there; the dashboard
 *                              shows a pending banner)
 *   Capacitor  + verified  → render the portal as normal
 *   Capacitor  + unverified → redirect to /driver/verify-on-web
 *
 * Plus:
 *   Anywhere   + verified  + on web → redirect to /driver/download-app.
 *                              The portal exists for unverified drivers
 *                              to onboard; verified drivers belong in
 *                              the native app.
 *
 * Shows a brief loading state on first mount so the page doesn't
 * flicker the protected content before the redirect lands.
 */
export function DriverPortalGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/driver/me/status", {
          cache: "no-store",
        });
        if (!res.ok) {
          // 401 will be caught by AuthFetchGuard and route to login.
          // Any other error: leave the page in checking state — the
          // user will retry on a refresh.
          return;
        }
        const data = (await res.json()) as {
          hasDriverRecord: boolean;
          activated: boolean;
        };
        if (cancelled) return;

        const native = isNativeApp();
        const verified = data.activated;

        // Verified + on web → push to download-app.
        if (!native && verified) {
          router.replace("/driver/download-app");
          return;
        }
        // Native + unverified → push to verify-on-web.
        if (native && !verified) {
          router.replace("/driver/verify-on-web");
          return;
        }

        // All other combos: allow the portal. (Web + unverified can
        // still see the portal — it's where they complete onboarding.)
        setAllowed(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (checking || !allowed) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="space-y-3 text-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-rajlo-red border-t-transparent" />
          <p className="text-sm font-semibold text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
