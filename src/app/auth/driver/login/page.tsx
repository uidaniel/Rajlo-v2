"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, AuthField, AuthSubmit } from "@/components/auth-shell";

export default function DriverLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsLoading(false);
    window.location.href = "/driver";
  };

  return (
    <AuthShell
      title="Driver sign in"
      subtitle="Welcome back. Let's get on the road."
      audience="driver"
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
          placeholder="driver@example.com"
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
        <AuthSubmit onClick={handleLogin} loading={isLoading} disabled={!email || !password}>
          Sign in
        </AuthSubmit>
        <p className="text-center text-sm text-muted">
          New to Rajlo?{" "}
          <Link href="/driver-join" className="font-semibold text-rajlo-red hover:underline">
            Become a driver
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
