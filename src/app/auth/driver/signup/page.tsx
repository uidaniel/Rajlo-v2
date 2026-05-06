"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, AuthField, AuthSubmit } from "@/components/auth-shell";

export default function DriverSignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsLoading(false);
    window.location.href = "/driver/onboarding";
  };

  return (
    <AuthShell
      title="Become a Rajlo driver"
      subtitle="Create your account, then complete TA verification."
      audience="driver"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/auth/driver/login" className="font-semibold text-rajlo-red hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <AuthField label="Full name" placeholder="Your full name" value={name} onChange={setName} autoComplete="name" required />
        <AuthField label="Email" type="email" placeholder="driver@example.com" value={email} onChange={setEmail} autoComplete="email" required />
        <AuthField label="Phone" type="tel" placeholder="+1 876 ..." value={phone} onChange={setPhone} autoComplete="tel" required />
        <AuthField label="Red plate number" placeholder="e.g. PP1234" value={plate} onChange={setPlate} required />

        <div className="rounded-xl bg-primary-soft px-4 py-3 text-xs text-rajlo-black">
          <strong>Red plate only.</strong> Rajlo accepts drivers with valid TA Franchise Certificates and PPV-rated insurance.
        </div>

        <AuthSubmit onClick={handleSubmit} loading={isLoading} disabled={!name || !email || !phone || !plate}>
          Create account & start onboarding
        </AuthSubmit>
      </div>
    </AuthShell>
  );
}
