"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, AuthField, AuthSubmit } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={`If an account exists for ${email}, you'll get a reset link shortly.`}
      >
        <div className="space-y-4 text-center">
          <Link
            href="/auth/rider/login"
            className="block rounded-full bg-rajlo-red px-6 py-3.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Back to sign in
          </Link>
          <button
            onClick={() => setSent(false)}
            className="text-sm font-medium text-muted hover:text-foreground"
          >
            Use a different email
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email associated with your Rajlo account and we'll send you a reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/auth/rider/login" className="font-semibold text-rajlo-red hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <AuthField
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <AuthSubmit onClick={handleSubmit} loading={isLoading} disabled={!email}>
          Send reset link
        </AuthSubmit>
      </div>
    </AuthShell>
  );
}
