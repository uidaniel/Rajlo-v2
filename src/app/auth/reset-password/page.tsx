"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, AuthField, AuthSubmit } from "@/components/auth-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const mismatch = password.length > 0 && confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  const handleSubmit = async () => {
    if (mismatch || tooShort || !password || !confirm) return;
    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    setDone(true);
    // Sign out so the user returns to login with their new password.
    setTimeout(() => router.push("/auth/rider/login"), 1500);
  };

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Redirecting you to sign in…">
        <Link
          href="/auth/rider/login"
          className="block rounded-full bg-rajlo-red px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-primary-hover"
        >
          Continue to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Pick something at least 8 characters long."
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rajlo-red/20 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
            {error}
          </div>
        )}

        <AuthField
          label="New password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          icon="password"
          required
        />
        <AuthField
          label="Confirm new password"
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          icon="password"
          required
        />
        {tooShort && (
          <p className="text-xs text-rajlo-red">Password must be at least 8 characters.</p>
        )}
        {mismatch && <p className="text-xs text-rajlo-red">Passwords don&apos;t match.</p>}
        <AuthSubmit
          onClick={handleSubmit}
          loading={isLoading}
          disabled={!password || !confirm || mismatch || tooShort}
        >
          Update password
        </AuthSubmit>
      </div>
    </AuthShell>
  );
}
