"use client";

import Link from "next/link";
import { useState } from "react";

export default function RiderSignupPage() {
  const [step, setStep] = useState<"info" | "verify" | "complete">("info");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setStep("verify");
    setIsLoading(false);
  };

  const handleVerify = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setStep("complete");
    setIsLoading(false);
  };

  if (step === "complete") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="p-6 text-center">
          <Link href="/" className="inline-block text-2xl font-bold text-primary mb-4">
            RAJLO
          </Link>
        </div>

        <div className="flex-1 grid place-items-center px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 md:p-8 text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mx-auto">
              <svg className="h-8 w-8 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-bold">You're All Set!</h1>
              <p className="text-muted text-sm mt-2">Welcome to RAJLO, {name}! Let's go!</p>
            </div>

            <Link
              href="/rider/request"
              className="block rounded-lg bg-primary py-3 font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Request Your First Ride
            </Link>

            <p className="text-xs text-muted">
              By signing up, you agree to our{" "}
              <Link href="/legal/terms" className="font-medium text-primary hover:underline">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="p-6 text-center">
          <Link href="/" className="inline-block text-2xl font-bold text-primary mb-4">
            RAJLO
          </Link>
          <h1 className="text-3xl font-bold">Verify Your Number</h1>
          <p className="text-muted mt-2">We sent a code to {phone}</p>
        </div>

        <div className="flex-1 grid place-items-center px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 md:p-8 space-y-6">
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  className="w-full text-center rounded-lg border border-line bg-surface px-4 py-3 text-2xl font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="0"
                />
              ))}
            </div>

            <button
              onClick={handleVerify}
              disabled={isLoading}
              className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isLoading ? "Verifying..." : "Verify"}
            </button>

            <p className="text-center text-sm text-muted">
              <button className="text-primary hover:underline">Resend code</button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/10 to-primary/5">
      {/* Header */}
      <div className="p-6 text-center">
        <Link href="/" className="inline-block text-2xl font-bold text-primary mb-4">
          RAJLO
        </Link>
        <p className="text-sm font-medium text-muted -mt-2 mb-4">Let's go!</p>
        <h1 className="text-3xl md:text-4xl font-bold">Create Your Account</h1>
          <p className="text-muted mt-2">Join thousands of riders on RAJLO — Let's go!</p>
      </div>

      {/* Form */}
      <div className="flex-1 grid place-items-center px-4 pb-8">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 md:p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <input
                type="tel"
                placeholder="+1 (234) 567-8900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          <button
            onClick={handleSignup}
            disabled={isLoading || !name || !email || !phone}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isLoading ? "Creating Account..." : "Continue"}
          </button>

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/auth/rider/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}