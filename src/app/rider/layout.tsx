import { PortalLayout } from "@/components/portal-layout";
import { SessionGuard } from "@/components/session-guard";
import { PreferencesProvider } from "@/components/preferences-provider";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { riderNav } from "@/lib/mock-data";

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout
      title="Rider Portal"
      subtitle="Book rides, track trips, and manage safety settings."
      nav={riderNav}
    >
      <SessionGuard />
      <PreferencesProvider />
      {/* Pull-to-refresh — touch-only, mobile-only, scoped to the
         rider portal. Listens at window level and fires
         router.refresh() once the user releases past the trigger
         distance. Renders a small floating pill that follows the
         finger down. */}
      <PullToRefresh />
      {children}
    </PortalLayout>
  );
}