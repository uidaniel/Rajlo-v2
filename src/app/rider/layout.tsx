import { PortalLayout } from "@/components/portal-layout";
import { SessionGuard } from "@/components/session-guard";
import { riderNav } from "@/lib/mock-data";

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout
      title="Rider Portal"
      subtitle="Book rides, track trips, and manage safety settings."
      nav={riderNav}
    >
      <SessionGuard />
      {children}
    </PortalLayout>
  );
}