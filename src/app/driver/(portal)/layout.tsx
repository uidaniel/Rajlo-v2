import { redirect } from "next/navigation";
import { PortalLayout } from "@/components/portal-layout";
import { driverNav } from "@/lib/mock-data";
import { getDriverStatus } from "@/lib/driver-status";

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
      {children}
    </PortalLayout>
  );
}
