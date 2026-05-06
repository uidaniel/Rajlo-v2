"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, AuthField, AuthSubmit } from "@/components/auth-shell";

export default function RiderLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsLoading(false);
    window.location.href = "/rider";
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your rider account"
      audience="rider"
      footer={
        <Link href="/auth/forgot-password" className="hover:text-foreground hover:underline">
          Forgot password?
        </Link>
      }
    >
      <div className="space-y-5">
        <AuthField
          label="Email or phone"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <AuthField
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        <AuthSubmit
          onClick={handleLogin}
          loading={isLoading}
          disabled={!email || !password}
        >
          Sign in
        </AuthSubmit>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface px-3 text-muted">or</span>
          </div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface-soft py-3 text-sm font-medium hover:bg-surface"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12.545,10.847v3.355h5.892c-0.275,1.48-1.074,2.468-2.266,3.27c1.526,1.287,3.605,2.08,6.04,2.08 c4.537,0,8.302-3.02,8.302-8.386c0-0.514-0.05-1.021-0.15-1.49c-0.473-3.324-3.617-5.677-7.952-5.677 c-2.6,0-4.926,1.065-6.565,2.812H12.545z" />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/auth/rider/signup" className="font-semibold text-rajlo-red hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
