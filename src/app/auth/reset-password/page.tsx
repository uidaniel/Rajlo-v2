import { ScreenTemplate } from "@/components/screen-template";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ScreenTemplate
        title="Reset Password"
        description="Dummy password reset screen with token validation and new password confirmation."
        actions={[
          { label: "Back to Login", href: "/auth/rider/login" },
        ]}
      />
    </main>
  );
}
