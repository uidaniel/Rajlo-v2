"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, AuthField, AuthSubmit } from "@/components/auth-shell";

export default function RiderSignupPage() {
  const [step, setStep] = useState<"info" | "verify" | "complete">("info");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setStep("verify");
    setIsLoading(false);
  };

  const handleVerify = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setStep("complete");
    setIsLoading(false);
  };

  if (step === "complete") {
    return (
      <AuthShell title="You're all set!" subtitle={`Welcome to Rajlo, ${name}.`} audience="rider">
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
            <svg className="h-8 w-8 text-rajlo-red" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <Link
            href="/rider/request"
            className="block rounded-full bg-rajlo-red px-6 py-3.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Request your first ride
          </Link>
          <p className="text-xs text-muted">
            By signing up, you agree to our{" "}
            <Link href="/legal/terms" className="font-semibold text-rajlo-red hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="font-semibold text-rajlo-red hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </AuthShell>
    );
  }

  if (step === "verify") {
    return (
      <AuthShell
        title="Verify your number"
        subtitle={`We sent a 6-digit code to ${phone}.`}
        audience="rider"
        footer={
          <button className="font-semibold text-rajlo-red hover:underline">Resend code</button>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-6 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="rounded-xl border border-line bg-surface py-3 text-center text-xl font-bold outline-none focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
                placeholder="0"
              />
            ))}
          </div>
          <AuthSubmit onClick={handleVerify} loading={isLoading}>
            Verify
          </AuthSubmit>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join Rajlo and book a ride anywhere, anytime."
      audience="rider"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/auth/rider/login" className="font-semibold text-rajlo-red hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <AuthField label="Full name" placeholder="Your name" value={name} onChange={setName} autoComplete="name" required />
        <AuthField label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} autoComplete="email" required />
        <AuthField label="Phone number" type="tel" placeholder="+1 876 ..." value={phone} onChange={setPhone} autoComplete="tel" required />
        <AuthSubmit onClick={handleSignup} loading={isLoading} disabled={!name || !email || !phone}>
          Continue
        </AuthSubmit>
        <p className="text-center text-xs text-muted">
          By continuing you agree to our{" "}
          <Link href="/legal/terms" className="font-semibold text-rajlo-red hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="font-semibold text-rajlo-red hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
