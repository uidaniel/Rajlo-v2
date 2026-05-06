import { PortalLayout } from "@/components/portal-layout";
import { driverNav } from "@/lib/mock-data";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
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