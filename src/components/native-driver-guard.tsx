"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";

/**
 * Capacitor-only navigation guard for the driver app.
 *
 * The driver native app is a thin WebView wrapper around the live
 * Next.js site. By default any link inside the WebView (logo → home,
 * deep-link from a notification, etc.) can navigate to any path on
 * the site — including /rider, /admin, marketing pages. That breaks
 * the mental model of a "Rajlo Driver" app.
 *
 * This component runs on every navigation and snaps the user back to
 * /driver whenever they end up somewhere they shouldn't be. On the
 * web (non-Capacitor) it's a no-op so the marketing site stays open
 * to everyone.
 *
 * Allowed prefixes:
 *   - /driver          the driver portal
 *   - /auth/driver     driver sign-in / sign-up
 *   - /auth/forgot…    shared password recovery
 *   - /auth/reset…
 *   - /auth/callback   Supabase OAuth callback
 *   - /legal           terms, privacy
 *   - /403, /404       error pages
 *
 * Everything else → redirect to /driver. The server-side proxy in
 * src/proxy.ts then handles the unauthenticated case (bounces to
 * /auth/driver/login if no session).
 */

const ALLOWED_PREFIXES = [
  "/driver",
  "/auth/driver",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/callback",
  "/auth/confirm",
  "/legal",
  "/403",
  "/404",
];

function isAllowedPath(path: string): boolean {
  if (path === "/driver") return true;
  return ALLOWED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

export function NativeDriverGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    if (!pathname) return;
    if (isAllowedPath(pathname)) return;
    // Off-portal navigation inside the native app — bounce back to
    // the driver dashboard. `replace` (not push) so the back button
    // doesn't return them to the disallowed page.
    router.replace("/driver");
  }, [pathname, router]);

  return null;
}
