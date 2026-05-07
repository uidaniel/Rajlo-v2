import Link from "next/link";
import { LogoIcon } from "@/components/logo";
import { ArcWatermark } from "@/components/arc-pattern";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  PhoneMockup,
  RiderRequestScreen,
  DriverMatchScreen,
  ComplianceScreen,
} from "@/components/phone-mockup";
import {
  FadeUp,
  Stagger,
  StaggerItem,
  CountUp,
  FloatY,
  WordReveal,
  HoverLift,
  ParallaxFloat,
} from "@/components/anim";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* ============== Header ============== */}
      <SiteHeader />

      {/* ============== Hero ============== */}
      <section className="relative overflow-hidden bg-rajlo-red text-white">
        <ArcWatermark size={720} variant="white" className="absolute -right-32 -top-20" />
        <ArcWatermark size={520} variant="white" className="absolute -bottom-32 -left-20 opacity-[0.05]" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-24 md:grid-cols-[1.05fr_0.95fr] md:py-32">
          <div className="relative z-10">
            <FadeUp delay={0.05}>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 font-secondary text-xs font-bold uppercase tracking-wider backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                Now serving all 14 parishes
              </span>
            </FadeUp>

            <h1 className="mt-6 text-6xl font-extrabold leading-[0.95] tracking-tight md:text-8xl">
              <WordReveal as="span" text="Book a ride" delay={0.15} className="block" />
              <WordReveal as="span" text="anywhere." delay={0.35} className="mt-1 block italic font-light" />
              <WordReveal as="span" text="anytime." delay={0.5} className="mt-1 block font-black" />
            </h1>

            <FadeUp delay={0.7}>
              <p className="mt-6 max-w-xl text-lg text-white/90 md:text-xl">
                Rajlo is Jamaica&apos;s rideshare platform — verified red-plate drivers,
                transparent parish-based fares, real-time tracking, multi-seat bookings.
                <br />
                <strong>Smooth streets. Real connections.</strong>
              </p>
            </FadeUp>

            <FadeUp delay={0.85}>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth/rider/signup"
                  className="group rounded-full bg-rajlo-black px-8 py-4 text-center text-base font-bold text-white shadow-lg shadow-black/30 transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-xl"
                >
                  Book your first ride →
                </Link>
                <Link
                  href="/driver-join"
                  className="rounded-full border-2 border-white/80 px-8 py-4 text-center text-base font-bold text-white transition-colors hover:bg-white/10"
                >
                  Drive with Rajlo
                </Link>
              </div>
            </FadeUp>

            <Stagger className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/85">
              <StaggerItem><Trust label="TA-verified drivers" /></StaggerItem>
              <StaggerItem><Trust label="Red plate only" /></StaggerItem>
              <StaggerItem><Trust label="PPV insured" /></StaggerItem>
              <StaggerItem><Trust label="24/7 support" /></StaggerItem>
            </Stagger>
          </div>

          {/* Phone stack with parallax tilt + gentle float */}
          <div className="relative hidden md:block">
            <ParallaxFloat className="relative" intensity={14}>
              <FloatY rotate={-8} delay={0} className="absolute -left-10 top-12">
                <PhoneMockup>
                  <DriverMatchScreen />
                </PhoneMockup>
              </FloatY>
              <FloatY rotate={6} delay={0.6} className="absolute -right-2 -top-4">
                <PhoneMockup>
                  <RiderRequestScreen />
                </PhoneMockup>
              </FloatY>
            </ParallaxFloat>
          </div>
        </div>
      </section>

      {/* ============== Stats band (animated counters) ============== */}
      <section className="border-y border-line bg-surface-soft py-10">
        <Stagger className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 md:grid-cols-4">
          <StaggerItem className="text-center md:text-left">
            <p className="text-4xl font-extrabold tracking-tight text-rajlo-red md:text-5xl">
              <CountUp to={14} />
            </p>
            <p className="mt-1 text-sm font-medium text-muted">parishes covered</p>
          </StaggerItem>
          <StaggerItem className="text-center md:text-left">
            <p className="text-4xl font-extrabold tracking-tight text-rajlo-red md:text-5xl">
              <CountUp to={10} />
            </p>
            <p className="mt-1 text-sm font-medium text-muted">TA documents verified per driver</p>
          </StaggerItem>
          <StaggerItem className="text-center md:text-left">
            <p className="text-4xl font-extrabold tracking-tight text-rajlo-red md:text-5xl">
              <CountUp to={100} suffix="%" />
            </p>
            <p className="mt-1 text-sm font-medium text-muted">red-plate-only drivers</p>
          </StaggerItem>
          <StaggerItem className="text-center md:text-left">
            <p className="text-4xl font-extrabold tracking-tight text-rajlo-red md:text-5xl">1–4</p>
            <p className="mt-1 text-sm font-medium text-muted">seats per booking</p>
          </StaggerItem>
        </Stagger>
      </section>

      {/* ============== Pillars ============== */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <FadeUp className="mb-14 max-w-3xl">
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Why Rajlo
          </p>
          <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Built for Jamaica.
            <br />
            <span className="text-rajlo-red">Built for trust.</span>
          </h2>
          <p className="mt-5 text-lg text-muted md:text-xl">
            Every ride is a reflection of our commitment to innovation, sustainability,
            and an elevated customer experience.
          </p>
        </FadeUp>

        <Stagger className="grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Reliability",
              body: "Real-time tracking, route optimization, and driver transparency — a consistently dependable choice for every commute.",
              icon: "⏱",
            },
            {
              title: "Safety",
              body: "Rigorous TA verification, in-app safety features, anonymous messaging, and 24/7 incident response.",
              icon: "🛡",
            },
            {
              title: "Driver Empowerment",
              body: "Flexible schedules, fair earnings, transparent payouts, and full TA-compliance support — drivers come first.",
              icon: "★",
            },
          ].map((pillar) => (
            <StaggerItem key={pillar.title}>
              <HoverLift className="group relative h-full overflow-hidden rounded-3xl border border-line bg-surface p-8 transition-all hover:border-rajlo-red hover:shadow-xl">
                <ArcWatermark
                  size={260}
                  variant="red"
                  className="absolute -right-12 -bottom-16 transition-opacity group-hover:opacity-20"
                />
                <div className="relative">
                  <div className="text-3xl">{pillar.icon}</div>
                  <p className="mt-4 text-2xl font-extrabold tracking-tight text-rajlo-red">
                    {pillar.title}
                  </p>
                  <p className="mt-3 text-base leading-relaxed">{pillar.body}</p>
                </div>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ============== App showcase ============== */}
      <section className="relative overflow-hidden bg-rajlo-black py-24 text-white">
        <ArcWatermark size={520} variant="red" className="absolute -left-32 top-0 opacity-[0.08]" />
        <div className="mx-auto max-w-6xl px-4">
          <FadeUp className="mb-14 max-w-3xl">
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
              The Rajlo experience
            </p>
            <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              One app.
              <br />
              Three powerful surfaces.
            </h2>
          </FadeUp>

          <Stagger className="grid gap-12 md:grid-cols-3 md:items-end" amount={0.1}>
            <StaggerItem className="text-center">
              <PhoneMockup>
                <RiderRequestScreen />
              </PhoneMockup>
              <p className="mt-6 text-xl font-bold">For riders</p>
              <p className="mt-1 text-sm text-white/60">
                Set route, pick seats, see your fare upfront, ride with confidence.
              </p>
            </StaggerItem>
            <StaggerItem className="text-center md:-mt-6">
              <PhoneMockup>
                <DriverMatchScreen />
              </PhoneMockup>
              <p className="mt-6 text-xl font-bold">Real-time matching</p>
              <p className="mt-1 text-sm text-white/60">
                Verified drivers, live ETAs, anonymous in-app messaging.
              </p>
            </StaggerItem>
            <StaggerItem className="text-center">
              <PhoneMockup>
                <ComplianceScreen />
              </PhoneMockup>
              <p className="mt-6 text-xl font-bold">For drivers</p>
              <p className="mt-1 text-sm text-white/60">
                TA compliance dashboard with renewal reminders so nothing lapses.
              </p>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* ============== How it works ============== */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <FadeUp className="mb-14 max-w-3xl">
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            How it works
          </p>
          <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            From request to arrival
            <br />
            in three taps.
          </h2>
        </FadeUp>
        <Stagger className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Set your route",
              body: "Pick parish-aware origin and destination. Rajlo computes a transparent fare before you confirm.",
            },
            {
              step: "02",
              title: "Match with a verified driver",
              body: "Every Rajlo driver holds a valid TA Franchise Certificate, current Certificate of Fitness, and PPV insurance.",
            },
            {
              step: "03",
              title: "Track, ride, rate",
              body: "Live ETA, in-app safety, and contactless payment. Rate the trip when you arrive.",
            },
          ].map((s) => (
            <StaggerItem key={s.step}>
              <HoverLift className="h-full rounded-3xl border border-line bg-surface p-8 transition-all hover:border-rajlo-red hover:shadow-lg">
                <p className="font-display text-7xl font-black text-rajlo-red opacity-90">{s.step}</p>
                <p className="mt-3 text-2xl font-extrabold tracking-tight">{s.title}</p>
                <p className="mt-2 text-base leading-relaxed text-muted">{s.body}</p>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ============== Popular routes ============== */}
      <section className="bg-surface-soft py-24">
        <div className="mx-auto max-w-6xl px-4">
          <FadeUp className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Transparent fares
              </p>
              <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
                Popular routes,
                <br />
                upfront prices.
              </h2>
            </div>
            <Link
              href="/fare-estimator"
              className="self-start rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover md:self-end"
            >
              Try the fare estimator →
            </Link>
          </FadeUp>

          <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" amount={0.1}>
            {[
              ["Half-Way-Tree", "Norman Manley Airport", "St. Andrew → Kingston", 2400],
              ["New Kingston", "Sangster Int'l Airport", "Kingston → St. James", 9800],
              ["Mandeville", "Negril", "Manchester → Westmoreland", 7200],
              ["Spanish Town", "Ocho Rios", "St. Catherine → St. Ann", 5400],
              ["Portmore", "Half-Way-Tree", "St. Catherine → St. Andrew", 1800],
              ["Montego Bay", "Falmouth", "St. James → Trelawny", 2100],
            ].map(([from, to, parish, fare]) => (
              <StaggerItem key={`${from}-${to}`}>
                <HoverLift className="group flex h-full flex-col gap-3 rounded-2xl border border-line bg-white p-5 transition-all hover:border-rajlo-red hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-secondary text-[11px] font-bold uppercase tracking-wider text-muted">
                      {parish}
                    </p>
                    <p className="mt-1 break-words text-base font-extrabold leading-snug sm:truncate">
                      {from} <span className="text-rajlo-red">→</span> {to}
                    </p>
                  </div>
                  <p className="shrink-0 sm:text-right">
                    <span className="font-secondary text-[10px] font-bold uppercase text-muted">from</span>
                    <span className="block text-xl font-extrabold">JMD {(fare as number).toLocaleString()}</span>
                  </p>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============== Compliance / TA documents ============== */}
      <section className="relative overflow-hidden bg-rajlo-red py-24 text-white">
        <ArcWatermark size={620} variant="white" className="absolute -right-32 -bottom-40" />
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="grid gap-12 md:grid-cols-[0.85fr_1.15fr] md:items-start">
            <FadeUp>
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-white/80">
                Red plate only
              </p>
              <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
                Every Rajlo driver
                <br />
                is TA-verified.
              </h2>
              <p className="mt-5 text-lg text-white/90">
                Ten mandatory documents, verified at onboarding and re-checked annually.
                Compliance lapses, the account suspends. No grey areas.
              </p>
            </FadeUp>
            <Stagger className="grid gap-3 sm:grid-cols-2" amount={0.1}>
              {[
                "TA Franchise Certificate",
                "TA Driver Badge",
                "Certificate of Fitness",
                "PPV Comprehensive Insurance",
                "Valid Driver's Licence (PPV)",
                "Police Record / Good Conduct",
                "TRN + NIS Registration",
                "Red Plate Vehicle Registration",
                "Identity selfie match",
                "Annual re-verification",
              ].map((doc) => (
                <StaggerItem
                  key={doc}
                  as="li"
                  className="flex items-start gap-3 rounded-xl bg-white/15 px-4 py-3 text-sm font-medium backdrop-blur"
                >
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                  {doc}
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* ============== Driver call-out ============== */}
      <section className="mx-auto max-w-6xl overflow-hidden px-4 py-24">
        <div className="grid gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <FadeUp>
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
              For drivers
            </p>
            <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Earn on your terms.
              <br />
              <span className="text-rajlo-red">Backed by Rajlo.</span>
            </h2>
            <p className="mt-5 text-lg text-muted md:text-xl">
              Flexible schedules, fair pay, transparent payouts, and full TA-compliance support
              — Rajlo is built for Jamaica&apos;s red-plate professionals.
            </p>
            <Stagger className="mt-8 grid gap-3 sm:grid-cols-2" amount={0.1}>
              {[
                "Compliance dashboard with renewal reminders",
                "Transparent earnings breakdown per trip",
                "Multi-seat shared rides earn more",
                "24/7 driver support",
              ].map((perk) => (
                <StaggerItem
                  key={perk}
                  as="li"
                  className="flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium"
                >
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rajlo-red" />
                  {perk}
                </StaggerItem>
              ))}
            </Stagger>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/driver-join"
                className="rounded-full bg-rajlo-red px-7 py-3.5 text-center text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Become a Rajlo driver →
              </Link>
              <Link
                href="/auth/driver/login"
                className="rounded-full border border-line bg-surface px-7 py-3.5 text-center text-sm font-bold text-foreground hover:bg-surface-soft"
              >
                Driver sign in
              </Link>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="relative mx-auto w-full max-w-[320px]">
              {/* Soft red glow background — sized to the phone instead of the
                  parent column so the negative inset can't push past the
                  viewport edge on mobile (was causing horizontal scroll). */}
              <div className="absolute inset-x-0 inset-y-0 -mx-3 -my-6 rounded-3xl bg-rajlo-red/10" />
              <div className="relative">
                <FloatY amplitude={4} duration={5}>
                  <PhoneMockup>
                    <ComplianceScreen />
                  </PhoneMockup>
                </FloatY>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ============== Voices ============== */}
      <section className="bg-surface-soft py-24">
        <div className="mx-auto max-w-6xl px-4">
          <FadeUp className="mb-14 max-w-3xl">
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
              Voices from the road
            </p>
            <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              People love
              <br />
              moving with Rajlo.
            </h2>
            <p className="mt-3 text-xs text-muted">
              Illustrative quotes — Rajlo is preparing for public launch in Jamaica.
            </p>
          </FadeUp>

          <Stagger className="grid gap-5 md:grid-cols-3" amount={0.1}>
            {[
              {
                quote:
                  "I always know what I'm paying before I tap confirm. No more haggling at the end of a ride.",
                name: "Ashanti R.",
                role: "Young professional · Kingston",
              },
              {
                quote:
                  "The compliance dashboard is a lifesaver. My COF was about to expire and Rajlo flagged it weeks in advance.",
                name: "Marlon K.",
                role: "Driver · St. Andrew",
              },
              {
                quote:
                  "Booking three seats for me and my classmates was as easy as one. We split the fare in the app.",
                name: "Tarique B.",
                role: "Student · Manchester",
              },
            ].map((t) => (
              <StaggerItem key={t.name}>
                <HoverLift className="relative h-full overflow-hidden rounded-3xl border border-line bg-white p-8">
                  <ArcWatermark
                    size={200}
                    variant="red"
                    className="absolute -right-10 -top-10 opacity-[0.05]"
                  />
                  <div className="relative">
                    <p className="font-display text-5xl leading-none text-rajlo-red">&ldquo;</p>
                    <blockquote className="font-secondary mt-2 text-base leading-relaxed">{t.quote}</blockquote>
                    <figcaption className="mt-6 border-t border-line pt-4">
                      <p className="text-sm font-bold">{t.name}</p>
                      <p className="text-xs text-muted">{t.role}</p>
                    </figcaption>
                  </div>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ============== FAQ ============== */}
      <section className="mx-auto max-w-4xl px-4 py-24">
        <FadeUp className="mb-12 text-center">
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Frequently asked
          </p>
          <h2 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Everything you need to know.
          </h2>
        </FadeUp>

        <Stagger className="space-y-3" amount={0.05}>
          {[
            {
              q: "What makes Rajlo different from other rideshare apps in Jamaica?",
              a: "Rajlo is red-plate-only — every driver holds a valid TA Franchise Certificate, current Certificate of Fitness, and PPV insurance. We verify all 10 mandatory TA documents at onboarding and re-check them annually.",
            },
            {
              q: "How is my fare calculated?",
              a: "Fares use parish-aware rules: a base fare, distance, multi-seat factor, and platform fee. We show the full breakdown before you confirm — no surge surprises.",
            },
            {
              q: "Can I book multiple seats in one trip?",
              a: "Yes. Rajlo supports 1 to 4 seats per booking. Drivers can run shared-ride or private mode depending on their preference.",
            },
            {
              q: "What if my driver's documents expire?",
              a: "Drivers receive in-app, email, and SMS reminders at 60, 30, and 7 days before any document expires. If a document lapses, the driver is auto-suspended until renewed and re-approved.",
            },
            {
              q: "How do I become a Rajlo driver?",
              a: "Create a driver account, upload all 10 required TA documents, and an admin reviews each within 48 hours. Once approved, you're activated and can start accepting trips.",
            },
            {
              q: "What about safety?",
              a: "Live trip tracking, an in-app SOS button, anonymous in-app messaging, and 24/7 incident response. Riders can share their live trip with a trusted contact in one tap.",
            },
          ].map((item) => (
            <StaggerItem key={item.q}>
              <details className="group rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-rajlo-red">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-bold md:text-lg">
                  {item.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-rajlo-red transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-base leading-relaxed text-muted">{item.a}</p>
              </details>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ============== Final CTA ============== */}
      <section className="relative overflow-hidden bg-rajlo-black py-28 text-white">
        <ArcWatermark size={720} variant="red" className="absolute -right-40 -bottom-40 opacity-[0.12]" />
        <ArcWatermark size={520} variant="white" className="absolute -left-20 -top-20 opacity-[0.04]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <FadeUp>
            <div className="inline-flex">
              <FloatY amplitude={4} duration={3.4}>
                <LogoIcon height={56} className="text-rajlo-red" />
              </FloatY>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="mt-8 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
              Ready to move
              <br />
              <span className="italic font-light text-rajlo-red">with ease?</span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 md:text-xl">
              Sign up takes under a minute. Verify your number and you&apos;re ready to book your first Rajlo.
            </p>
          </FadeUp>
          <FadeUp delay={0.3}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/rider/signup"
                className="rounded-full bg-rajlo-red px-10 py-4 text-base font-bold text-white shadow-xl shadow-rajlo-red/40 transition-transform hover:-translate-y-0.5 hover:bg-primary-hover"
              >
                Book a ride →
              </Link>
              <Link
                href="/driver-join"
                className="rounded-full border-2 border-white/40 px-10 py-4 text-base font-bold text-white transition-colors hover:bg-white/10"
              >
                Drive with Rajlo
              </Link>
            </div>
          </FadeUp>
          <p className="mt-10 text-sm font-bold tracking-wider text-white/50">
            <em>Let&apos;s go!</em>
          </p>
        </div>
      </section>

      {/* ============== Footer ============== */}
      <SiteFooter />
    </div>
  );
}

function Trust({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {label}
    </span>
  );
}
