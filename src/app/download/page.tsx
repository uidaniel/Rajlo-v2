import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { ArcWatermark } from "@/components/arc-pattern";

/**
 * Public APK download page. Lives at `/download` so testers can hit
 * a clean, shareable URL (`https://rajlo-v2.vercel.app/download`)
 * instead of the raw `/rajlo-driver.apk` file URL.
 *
 * No auth gate — anyone with the link can install. While we're pre-
 * launch this replaces the role a Play Store listing will eventually
 * play. Drivers who go through this page get the same APK as Play
 * Store testers would; once we move to the store, we'll keep this
 * page around as a fallback for sideload requests.
 */

export const metadata: Metadata = {
  title: "Download Rajlo Driver — Android beta",
  description:
    "Install the Rajlo Driver Android app. Verified red-plate drivers can sign in and start taking rides across Jamaica.",
};

const APK_PATH = "/rajlo-driver.apk";

export default function DownloadPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Brand corner motif */}
      <ArcWatermark
        size={520}
        variant="red"
        className="absolute -right-24 -bottom-32"
      />

      <div className="relative mx-auto max-w-2xl px-4 py-10 md:py-16">
        {/* Top logo strip */}
        <div className="flex items-center justify-between">
          <Logo size="md" tagline />
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-wider text-muted hover:text-foreground"
          >
            Home
          </Link>
        </div>

        {/* Hero card */}
        <section className="relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-rajlo-red via-[#c00d0c] to-rajlo-black p-8 text-white shadow-2xl md:p-12">
          <ArcWatermark
            size={420}
            variant="white"
            className="pointer-events-none absolute -right-20 -bottom-32 opacity-[0.08]"
          />
          <div className="relative space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
              <Icon name="shield" className="h-3.5 w-3.5" />
              Android · beta
            </span>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              Drive with Rajlo.
            </h1>
            <p className="text-base leading-relaxed text-white/90">
              The Rajlo Driver app keeps you online while your phone&apos;s
              locked, pings you the second a rider hails nearby, and turns
              every trip into one-tap navigation. No Play Store account
              needed — just install the APK below.
            </p>

            <a
              href={APK_PATH}
              download
              className="mt-2 inline-flex items-center justify-center gap-3 rounded-full bg-white px-7 py-4 text-base font-bold text-rajlo-black shadow-lg transition-transform hover:-translate-y-0.5"
            >
              <Icon name="upload" className="h-5 w-5 rotate-180" />
              Download for Android
            </a>

            <p className="text-xs text-white/70">
              ~6 MB · works on Android 8.0 and newer
            </p>
          </div>
        </section>

        {/* Install steps */}
        <section className="mt-8 rounded-3xl border border-line bg-surface p-6 md:p-8">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-rajlo-red">
              <Icon name="check-circle" className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-extrabold tracking-tight">
              Install in 3 steps
            </h2>
          </div>

          <ol className="mt-5 space-y-4">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rajlo-red text-sm font-extrabold text-white">
                  {i + 1}
                </span>
                <div className="space-y-1">
                  <p className="font-bold leading-snug">{step.title}</p>
                  <p className="text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">Heads up — &ldquo;Unknown apps&rdquo;</p>
            <p className="mt-1 leading-relaxed">
              The first time you install an app from outside the Play Store,
              Android will ask permission. Tap{" "}
              <strong>Settings</strong> on that prompt, toggle{" "}
              <strong>Allow from this source</strong> for your browser, then
              tap <strong>Install</strong>. You only need to do this once.
            </p>
          </div>
        </section>

        {/* iOS note */}
        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-surface-soft p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-muted">
            <Icon name="upload" className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <p className="font-bold">iPhone coming next</p>
            <p className="text-sm leading-relaxed text-muted">
              iOS support is on the launch roadmap. For now, every Rajlo
              feature is web-accessible via the rider portal — point your
              passengers at{" "}
              <Link
                href="/"
                className="font-bold text-rajlo-red underline underline-offset-2"
              >
                rajlo.com
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 text-center">
          <p className="text-xs text-muted">
            Questions? Email{" "}
            <a
              href="mailto:support@rajlo.com"
              className="font-bold text-rajlo-red hover:underline"
            >
              support@rajlo.com
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

const STEPS: { title: string; body: string }[] = [
  {
    title: "Tap the download button above",
    body: "Your phone will save `rajlo-driver.apk` to your Downloads folder. If your browser asks whether to keep it, choose Keep.",
  },
  {
    title: "Open the downloaded file",
    body: "Pull down your notification shade and tap the download notification, or open the Files app → Downloads → rajlo-driver.apk.",
  },
  {
    title: "Tap Install, then Open",
    body: "After install, sign in with the phone number or Google account you registered with Rajlo. The app will auto-update as we ship improvements — no need to re-download.",
  },
];
