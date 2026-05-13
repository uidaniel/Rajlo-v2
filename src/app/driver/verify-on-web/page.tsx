"use client";

import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

/**
 * Capacitor-only screen shown when an unverified driver opens the
 * native app. The full driver experience requires admin verification;
 * verification only happens through the web onboarding flow at
 * rajlo.com. We show this dead-end here with a clear path forward.
 */
export default function DriverVerifyOnWebPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/auth/driver/login");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-16">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-rajlo-black via-rajlo-black to-[#1a1d10] p-8 text-white shadow-2xl md:p-12">
        <ArcWatermark
          size={420}
          variant="red"
          className="pointer-events-none absolute -right-20 -bottom-32 opacity-[0.18]"
        />
        <div className="relative space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">
            <Icon name="shield-alert" className="h-3.5 w-3.5" />
            Verification pending
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            Finish verification on the web first.
          </h1>
          <p className="text-base leading-relaxed text-white/85">
            The Rajlo Driver app is for verified drivers only. To get
            verified you need to complete onboarding from a regular
            browser — you&apos;ll upload your TA franchise, COF,
            insurance, driver&apos;s licence, police record, and selfie.
            Once admin approves your application you can come back here
            and sign in.
          </p>

          <div className="mt-2 space-y-2 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">
              Step by step
            </p>
            <ol className="space-y-2 text-sm text-white/90">
              <li>
                <strong>1.</strong> Open <strong>rajlo.com</strong> on your
                phone&apos;s browser (Chrome) or a laptop.
              </li>
              <li>
                <strong>2.</strong> Sign in with the same email you used here
                and complete the onboarding form.
              </li>
              <li>
                <strong>3.</strong> Wait for admin approval — usually within
                24 hours. You&apos;ll get an email when it&apos;s done.
              </li>
              <li>
                <strong>4.</strong> Come back here and sign in. You&apos;ll
                land straight in the driver dashboard.
              </li>
            </ol>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white/15 px-5 py-3 text-sm font-bold text-white backdrop-blur hover:bg-white/25"
          >
            <Icon name="log-out" className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
