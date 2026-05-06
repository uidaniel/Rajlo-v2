import { ScreenTemplate } from "@/components/screen-template";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ScreenTemplate
        title="Forgot Password"
        description="Dummy password recovery flow with email/phone OTP validation."
        actions={[
          { label: "Rider Login", href: "/auth/rider/login" },
          { label: "Driver Login", href: "/auth/driver/login" },
        ]}
      />
    </main>
  );
}
