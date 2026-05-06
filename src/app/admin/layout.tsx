import { PortalLayout } from "@/components/portal-layout";
import { adminNav } from "@/lib/mock-data";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout
      title="Admin/Ops Portal"
      subtitle="Verification operations, pricing controls, and incident workflows."
      nav={adminNav}
    >
      {children}
    </PortalLayout>
  );
}