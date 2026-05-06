import { ScreenTemplate } from "@/components/screen-template";
import { verificationQueue } from "@/lib/mock-data";

export default function AdminHomePage() {
  return (
    <ScreenTemplate
      title="Admin Login / Home"
      description="Entry screen for operations administrators with queue and policy highlights."
      stats={[
        { label: "Admins Online", value: "12" },
        { label: "Pending Reviews", value: "53" },
        { label: "Escalations", value: "4" },
      ]}
      items={verificationQueue}
      actions={[
        { label: "Open Dashboard", href: "/admin/dashboard" },
        { label: "Review Queue", href: "/admin/verification-queue" },
      ]}
    />
  );
}