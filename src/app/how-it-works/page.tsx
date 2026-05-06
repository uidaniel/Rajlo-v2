import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { ArcWatermark } from "@/components/arc-pattern";

const steps = [
  {
    n: "01",
    title: "Set your route",
    body: "Enter pickup and dropoff. We detect your parishes and show a transparent fare before you confirm.",
  },
  {
    n: "02",
    title: "Pick your seats",
    body: "Riding solo or with a group? Book 1–4 seats in one tap.",
  },
  {
    n: "03",
    title: "Match a verified driver",
    body: "Every Rajlo driver holds a current TA Franchise Certificate, Driver Badge, COF, and PPV insurance.",
  },
  {
    n: "04",
    title: "Track in real time",
    body: "See your driver approach. Share your live trip with a trusted contact.",
  },
  {
    n: "05",
    title: "Pay seamlessly",
    body: "Charged at the end of the trip. Get a transparent receipt with parish breakdown.",
  },
  {
    n: "06",
    title: "Rate your ride",
    body: "Tell us how it went. Your feedback shapes driver standards and the Rajlo experience.",
  },
];

export default function HowItWorksPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden bg-rajlo-red py-20 text-white">
        <ArcWatermark size={620} variant="white" className="absolute -right-24 -bottom-24" />
        <div className="relative mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
            How Rajlo works
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-extrabold tracking-tight md:text-6xl">
            Smooth streets, real connections, every ride.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/90">
            Six taps from idea to arrival — Jamaica&apos;s only red-plate-only rideshare with TA-verified drivers and parish-aware pricing.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-surface p-7 transition-shadow hover:shadow-md">
              <p className="text-3xl font-extrabold text-rajlo-red">{s.n}</p>
              <p className="mt-3 text-xl font-bold tracking-tight">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-soft py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight">Ready to ride?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Sign up takes under a minute. Verify your number, and you&apos;re ready to book your first Rajlo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/rider/signup"
              className="rounded-full bg-rajlo-red px-7 py-3.5 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Create rider account
            </Link>
            <Link
              href="/fare-estimator"
              className="rounded-full border border-line bg-surface px-7 py-3.5 text-sm font-semibold text-foreground hover:bg-surface"
            >
              Estimate a fare first
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
