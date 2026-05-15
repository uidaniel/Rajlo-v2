import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { PortalLayout } from "@/components/portal-layout";
import { SessionGuard } from "@/components/session-guard";
import { DriverActivityTracker } from "@/components/driver-activity-tracker";
import { DriverPortalGate } from "@/components/driver-portal-gate";
import { DriverOnlinePresence } from "@/components/driver-online-presence";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { driverNav } from "@/lib/mock-data";
import { getDriverStatus } from "@/lib/driver-status";

/**
 * Override the root viewport for the driver portal: lock pinch- and
 * double-tap-zoom off so the WebView behaves like a real native app
 * instead of a browser page. Maximum-scale=1 + userScalable=false is
 * the canonical recipe; we don't apply this globally because the
 * rider portal + marketing site need accessibility zoom for low-
 * vision riders. The driver UI is an operational tool with fixed
 * sizing, so locking zoom there is the right trade-off.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f10100",
  interactiveWidget: "resizes-content",
};

/**
 * Gates the activated driver portal. Routes the signed-in driver to:
 *   - /auth/driver/login    if they're not signed in (proxy also does this)
 *   - /driver/onboarding    if they haven't submitted onboarding yet
 *   - /driver/pending       if they've submitted but admin hasn't activated
 * Otherwise renders the portal with sidebar.
 */
export default async function DriverPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const status = await getDriverStatus();

  if (status.state === "unauthenticated") redirect("/auth/driver/login");
  if (status.state === "not_a_driver") redirect("/");
  if (status.state === "needs_onboarding") redirect("/driver/onboarding");
  if (
    status.state === "pending_verification" ||
    status.state === "rejected" ||
    status.state === "deactivated"
  ) {
    redirect("/driver/pending");
  }

  return (
    <PortalLayout
      title="Driver Portal"
      subtitle="Manage verification, trips, seats, and payouts."
      nav={driverNav}
    >
      <SessionGuard />
      {/* Pull-to-refresh — touch-only, mobile-only. The driver
         portal runs inside the Capacitor WebView where the native
         browser refresh isn't reachable, so the gesture is the only
         way to force a re-fetch. Riders use the browser's native
         refresh instead, so it's not mounted there. */}
      <PullToRefresh />
      {/* Pings /api/driver/heartbeat every 5 minutes while the
         driver is interacting with the portal, and flips them
         offline after 1hr of no interaction. Renders nothing. */}
      <DriverActivityTracker />
      {/* Global driver presence: keeps the GPS stream alive across
         every driver page while the driver is online (not just the
         dashboard), and surfaces a modal if the OS-level location is
         turned off mid-session. Renders nothing until that fires. */}
      <DriverOnlinePresence />
      {/* Client-side gate that bounces verified drivers on the web
         to /driver/download-app (they belong in the native app).
         The server-side getDriverStatus above already handles
         the unverified-redirect-to-pending/onboarding flow. */}
      <DriverPortalGate>{children}</DriverPortalGate>
    </PortalLayout>
  );
}
