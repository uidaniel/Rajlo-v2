"use client";

import Link from "next/link";
import { useState } from "react";

export default function RiderLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    // Simulate login delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    // Redirect to dashboard
    window.location.href = "/rider";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/10 to-primary/5">
      {/* Header */}
      <div className="p-6 text-center">
        <Link href="/" className="inline-block text-2xl font-bold text-primary mb-4">
          RAJLO
        </Link>
        <p className="text-sm font-medium text-muted -mt-2 mb-4">Let's go!</p>
        <h1 className="text-3xl md:text-4xl font-bold">Welcome Back</h1>
        <p className="text-muted mt-2">Sign in to your rider account</p>
      </div>

      {/* Form */}
      <div className="flex-1 grid place-items-center px-4 pb-8">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 md:p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email or Phone</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading || !email || !password}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-muted">or</span>
            </div>
          </div>

          <button className="w-full rounded-lg border border-line bg-surface-soft py-3 font-medium text-sm hover:bg-surface transition-colors flex items-center justify-center gap-2">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.545,10.847v3.355h5.892c-0.275,1.48-1.074,2.468-2.266,3.27c1.526,1.287,3.605,2.08,6.04,2.08 c4.537,0,8.302-3.02,8.302-8.386c0-0.514-0.05-1.021-0.15-1.49c-0.473-3.324-3.617-5.677-7.952-5.677 c-2.6,0-4.926,1.065-6.565,2.812H12.545z" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-muted">
            Don't have an account?{" "}
            <Link href="/auth/rider/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Footer Link */}
      <div className="px-4 py-4 text-center text-xs text-muted">
        <Link href="/auth/forgot-password" className="hover:underline">
          Forgot password?
        </Link>
      </div>
    </div>
  );
}