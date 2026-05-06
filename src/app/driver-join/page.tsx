import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { ArcWatermark } from "@/components/arc-pattern";

const requiredDocs = [
  "TA Franchise Certificate (route-specific, annual)",
  "TA Driver Badge / Photo ID (annual)",
  "Certificate of Fitness (COF) — annual vehicle inspection",
  "Comprehensive PPV Insurance (commercial passenger cover)",
  "Valid Jamaica Driver's Licence (PPV class)",
  "TRN (Taxpayer Registration Number)",
  "NIS (National Insurance Scheme) registration",
  "Police Record / Good Conduct Certificate",
  "Red Plate Vehicle Registration",
  "Identity selfie (matched against licence and badge)",
];

export default function DriverJoinPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden bg-rajlo-black py-20 text-white">
        <ArcWatermark size={620} variant="red" className="absolute -right-24 -bottom-24 opacity-[0.10]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rajlo-red">
              For drivers
            </p>
            <h1 className="mt-3 text-5xl font-extrabold tracking-tight md:text-6xl">
              Drive with Rajlo.
              <br />
              Earn on your terms.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">
              Flexible schedules, fair pay, and full TA-compliance support — Rajlo is built for Jamaica&apos;s red-plate professionals.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/driver/signup"
                className="rounded-full bg-rajlo-red px-7 py-3.5 text-center text-sm font-semibold text-white hover:bg-primary-hover"
              >
                Start onboarding
              </Link>
              <Link
                href="/auth/driver/login"
                className="rounded-full border-2 border-white/40 px-7 py-3.5 text-center text-sm font-semibold text-white hover:bg-white/10"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-7 text-rajlo-black shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-rajlo-red">
              Onboarding overview
            </p>
            <ol className="mt-4 space-y-4">
              {[
                ["Create your driver account", "Email, phone, and red plate number."],
                ["Upload TA documents", "All 10 documents required for activation."],
                ["Verification review", "Admin reviews each document — typically within 48 hours."],
                ["Go live", "Once approved, you can accept rides immediately."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rajlo-red text-xs font-extrabold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-10 md:grid-cols-[0.85fr_1.15fr] md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rajlo-red">
              Required documents
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
              All 10 documents are mandatory.
            </h2>
            <p className="mt-3 text-muted">
              Rajlo is red-plate-only. Every driver must hold a valid TA Franchise Certificate for public passenger vehicles. We re-verify annually.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {requiredDocs.map((doc) => (
              <li
                key={doc}
                className="flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium"
              >
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rajlo-red" />
                {doc}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-surface-soft py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h3 className="text-3xl font-extrabold tracking-tight">
            Empowered drivers, dependable rides.
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Rajlo values its drivers — flexible schedules, fair earnings, and comprehensive support to improve your day-to-day.
          </p>
          <Link
            href="/auth/driver/signup"
            className="mt-7 inline-block rounded-full bg-rajlo-red px-7 py-3.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Become a Rajlo driver
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
