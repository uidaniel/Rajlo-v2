import { PortalLayout } from "@/components/portal-layout";
import { riderNav } from "@/lib/mock-data";

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout
      title="Rider Portal"
      subtitle="Book rides, track trips, and manage safety settings."
      nav={riderNav}
    >
      {children}
    </PortalLayout>
  );
}