import { ScreenTemplate } from "@/components/screen-template";

export default function DriverSignupPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ScreenTemplate
        title="Driver Sign Up"
        description="Dummy onboarding screen to register new drivers with onboarding wizard start."
        actions={[
          { label: "Already have an account", href: "/auth/driver/login" },
          { label: "Start Onboarding", href: "/driver/onboarding" },
        ]}
      />
    </main>
  );
}
