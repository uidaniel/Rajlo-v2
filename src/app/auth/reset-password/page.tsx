"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, AuthField, AuthSubmit } from "@/components/auth-shell";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const mismatch = password.length > 0 && confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  const handleSubmit = async () => {
    if (mismatch || tooShort || !password || !confirm) return;
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in with your new password.">
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
        <AuthField
          label="New password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
        />
        <AuthField
          label="Confirm new password"
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
        />
        {tooShort && (
          <p className="text-xs text-rajlo-red">Password must be at least 8 characters.</p>
        )}
        {mismatch && (
          <p className="text-xs text-rajlo-red">Passwords don&apos;t match.</p>
        )}
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
