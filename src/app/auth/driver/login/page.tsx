import { ScreenTemplate } from "@/components/screen-template";

export default function DriverLoginPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ScreenTemplate
        title="Driver Login"
        description="Dummy auth screen for driver email/phone and password sign-in."
        actions={[
          { label: "Create Driver Account", href: "/auth/driver/signup" },
          { label: "Forgot Password", href: "/auth/forgot-password" },
          { label: "Driver Info", href: "/driver-join" },
        ]}
      />
    </main>
  );
}
