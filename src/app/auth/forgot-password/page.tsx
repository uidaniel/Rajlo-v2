"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, AuthField, AuthSubmit } from "@/components/auth-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    // Prefer the explicit production origin if NEXT_PUBLIC_SITE_URL is
    // set on the deploy — defends against the email landing in a
    // browser where `window.location.origin` later resolves to a
    // preview URL or, worse, localhost (an open dev server can
    // accidentally swallow the link). Falls back to the current
    // origin so dev still works without the env var.
    const baseOrigin =
      (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
        window.location.origin);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${baseOrigin}/auth/callback?next=/auth/reset-password`,
      },
    );

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

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
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rajlo-red/20 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
            {error}
          </div>
        )}

        <AuthField
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          icon="email"
          required
        />
        <AuthSubmit onClick={handleSubmit} loading={isLoading} disabled={!email}>
          Send reset link
        </AuthSubmit>
        <p className="text-center text-sm text-muted">
          Remembered it?{" "}
          <Link href="/auth/rider/login" className="font-semibold text-rajlo-red hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
