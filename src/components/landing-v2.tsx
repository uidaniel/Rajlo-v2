"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./logo";
import { ArcWatermark } from "./arc-pattern";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PhoneMockup, RiderRequestScreen, DriverMatchScreen } from "./phone-mockup";
import { Icon } from "./icons";
import { useGsap, gsap, ScrollTrigger } from "@/lib/use-gsap";
import { calculateRouteFare } from "@/lib/fare-engine";
import type { LandingCtaTargets } from "@/lib/landing-cta-targets";

/**
 * Landing page v2 — premium, animation-rich, dual-mode.
 *
 * Sections:
 *   1. Hero: animated headline, mode-toggle preview, parallax phones
 *   2. Two ways to ride: side-by-side cards for Private vs Route Taxi
 *   3. How it works: scroll-triggered 3-step reveal
 *   4. Fare transparency: live route-taxi calculator
 *   5. Why Rajlo: animated counters + brand pillars
 *   6. Drive with Rajlo: recruitment with earnings example
 *   7. Final CTA + footer
 *
 * Animations are scoped via gsap.context() inside each section's
 * useGsap hook so cleanup is automatic on unmount. Reduced-motion
 * users skip the choreography entirely (hook checks the OS pref).
 */
export function LandingV2({ cta }: { cta: LandingCtaTargets }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader
        bookHref={cta.riderHref}
        bookLabel={cta.riderIsDashboard ? "Open dashboard" : "Book a ride"}
      />
      <Hero cta={cta} />
      <TwoModes cta={cta} />
      <HowItWorks />
      <FareTransparency />
      <WhyRajlo />
      <DriveWithRajlo cta={cta} />
      <FinalCta cta={cta} />
      <SiteFooter />
    </div>
  );
}

/* ──────────────────────── 1. Hero ──────────────────────── */

function Hero({ cta }: { cta: LandingCtaTargets }) {
  const ref = useGsap<HTMLElement>((_ctx, root) => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Eyebrow ping in
    tl.from(root.querySelector("[data-anim='eyebrow']"), {
      y: -16,
      opacity: 0,
      duration: 0.5,
    });

    // Headline lines reveal one by one with a clip-path mask.
    const lines = root.querySelectorAll<HTMLElement>("[data-anim='line']");
    tl.from(
      lines,
      {
        y: 80,
        opacity: 0,
        duration: 0.85,
        stagger: 0.12,
        ease: "expo.out",
      },
      "-=0.2",
    );

    // Lead paragraph + CTAs + trust strip
    tl.from(
      "[data-anim='lede']",
      { y: 24, opacity: 0, duration: 0.6 },
      "-=0.4",
    );
    tl.from(
      "[data-anim='cta']",
      { y: 18, opacity: 0, duration: 0.5, stagger: 0.08 },
      "-=0.35",
    );
    tl.from(
      "[data-anim='trust'] > *",
      { y: 12, opacity: 0, duration: 0.4, stagger: 0.06 },
      "-=0.3",
    );

    // Phone stack: float up + tilt in
    tl.from(
      "[data-anim='phone-a']",
      { y: 60, rotation: -16, opacity: 0, duration: 0.9, ease: "power4.out" },
      "-=0.7",
    );
    tl.from(
      "[data-anim='phone-b']",
      { y: 80, rotation: 14, opacity: 0, duration: 0.9, ease: "power4.out" },
      "-=0.7",
    );

    // Continuous gentle float on the phones — separate from the entry timeline.
    gsap.to("[data-anim='phone-a']", {
      y: "+=12",
      rotation: "-=2",
      duration: 4.2,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    gsap.to("[data-anim='phone-b']", {
      y: "-=14",
      rotation: "+=2",
      duration: 4.6,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: 0.3,
    });

    // Mouse parallax on the whole phone stack.
    const stack = root.querySelector<HTMLElement>("[data-anim='phone-stack']");
    const onMove = (e: MouseEvent) => {
      if (!stack) return;
      const rect = root.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(stack, {
        x: x * 24,
        y: y * 16,
        duration: 0.6,
        ease: "power2.out",
      });
    };
    root.addEventListener("mousemove", onMove);
    return () => root.removeEventListener("mousemove", onMove);
  });

  return (
    <section
      ref={ref}
      className="relative isolate overflow-hidden bg-rajlo-red text-white"
    >
      {/* Ambient brand glow + arc pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 75% 35%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%), radial-gradient(ellipse at 15% 80%, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 55%)",
        }}
      />
      <ArcWatermark
        size={760}
        variant="white"
        className="absolute -right-40 -top-32 opacity-[0.07]"
      />
      <ArcWatermark
        size={560}
        variant="white"
        className="absolute -bottom-40 -left-24 opacity-[0.05]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-24 pt-20 md:grid-cols-[1.05fr_0.95fr] md:pb-32 md:pt-28">
        <div className="relative z-10">
          <span
            data-anim="eyebrow"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Live across all 14 parishes
          </span>

          <h1 className="mt-7 text-[3.2rem] font-extrabold leading-[0.95] tracking-tight md:text-[5.5rem]">
            <span data-anim="line" className="block">Two ways</span>
            <span
              data-anim="line"
              className="mt-1 block italic font-light"
            >
              to move across
            </span>
            <span data-anim="line" className="mt-1 block font-black">
              Jamaica.
            </span>
          </h1>

          <p
            data-anim="lede"
            className="mt-7 max-w-xl text-lg text-white/90 md:text-xl"
          >
            <span className="font-bold">Private rides</span> when you want the whole
            car — door-to-door, your route. <span className="font-bold">Route taxis</span>{" "}
            when you&apos;re going somewhere along a known corridor and want to
            pay the regulated fare. <span className="text-white">One app.</span>
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              data-anim="cta"
              href={cta.riderHref}
              className="group relative overflow-hidden rounded-full bg-rajlo-black px-8 py-4 text-center text-base font-bold text-white shadow-xl shadow-black/40 transition-transform hover:-translate-y-0.5"
            >
              <span className="relative z-10">
                {cta.riderIsDashboard ? "Open my dashboard" : "Get started — it's free"}{" "}
                <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
            </Link>
            <Link
              data-anim="cta"
              href={cta.driverHref}
              className="rounded-full border-2 border-white/80 px-8 py-4 text-center text-base font-bold text-white transition-colors hover:bg-white/10"
            >
              {cta.driverIsDashboard ? "Open driver dashboard" : "Drive with Rajlo"}
            </Link>
          </div>

          <div
            data-anim="trust"
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/85"
          >
            <Trust label="TA-verified drivers" />
            <Trust label="100% cashless" />
            <Trust label="Real-time tracking" />
            <Trust label="Built for Jamaica" />
          </div>
        </div>

        {/* Phone stack — desktop only */}
        <div className="relative hidden md:block" aria-hidden>
          <div data-anim="phone-stack" className="relative h-[520px]">
            <div
              data-anim="phone-a"
              className="absolute -left-6 top-12"
              style={{ willChange: "transform" }}
            >
              <PhoneMockup>
                <DriverMatchScreen />
              </PhoneMockup>
            </div>
            <div
              data-anim="phone-b"
              className="absolute -right-2 -top-4"
              style={{ willChange: "transform" }}
            >
              <PhoneMockup>
                <RiderRequestScreen />
              </PhoneMockup>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom marquee — Jamaica corridors as a continuous-scroll band */}
      <CorridorMarquee />
    </section>
  );
}

function Trust({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-rajlo-red">
        <Icon name="check-circle" className="h-3 w-3" />
      </span>
      <span className="font-semibold">{label}</span>
    </div>
  );
}

const CORRIDORS = [
  "Half Way Tree → Cross Roads",
  "Spanish Town → Downtown",
  "Mandeville → May Pen",
  "Montego Bay → Falmouth",
  "Ocho Rios → Browns Town",
  "Portmore → New Kingston",
  "Papine → Constant Spring",
  "Negril → Sav-la-Mar",
];

function CorridorMarquee() {
  const ref = useGsap<HTMLDivElement>((_ctx, root) => {
    const track = root.querySelector<HTMLElement>("[data-marquee-track]");
    if (!track) return;
    const half = track.scrollWidth / 2;
    gsap.to(track, {
      x: -half,
      duration: 38,
      ease: "none",
      repeat: -1,
    });
  });

  // Duplicated content so the loop seam is invisible.
  const items = [...CORRIDORS, ...CORRIDORS];

  return (
    <div
      ref={ref}
      className="relative overflow-hidden border-t border-white/15 bg-black/20 py-4 backdrop-blur-sm"
    >
      <div
        data-marquee-track
        className="flex w-max items-center gap-10 whitespace-nowrap text-sm font-semibold text-white/80"
      >
        {items.map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-10">
            <span className="opacity-90">{c}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────── 2. Two Modes ──────────────────────── */

function TwoModes({ cta }: { cta: LandingCtaTargets }) {
  const ref = useGsap<HTMLElement>((_ctx, root) => {
    gsap.from(root.querySelector("[data-anim='heading']"), {
      scrollTrigger: { trigger: root, start: "top 75%" },
      y: 36,
      opacity: 0,
      duration: 0.8,
      ease: "power3.out",
    });
    gsap.from("[data-anim='card-private']", {
      scrollTrigger: { trigger: root, start: "top 70%" },
      x: -50,
      opacity: 0,
      duration: 0.9,
      ease: "expo.out",
    });
    gsap.from("[data-anim='card-route']", {
      scrollTrigger: { trigger: root, start: "top 70%" },
      x: 50,
      opacity: 0,
      duration: 0.9,
      ease: "expo.out",
      delay: 0.1,
    });
  });

  return (
    <section ref={ref} className="relative bg-background py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div data-anim="heading" className="mb-14 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-rajlo-red">
            How you ride
          </p>
          <h2 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Two modes. <span className="italic font-light">One Rajlo.</span>
          </h2>
          <p className="mt-5 text-lg text-muted md:text-xl">
            Built for the way Jamaica actually moves — not a one-size-fits-all
            import.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Private Ride card — black, premium */}
          <article
            data-anim="card-private"
            className="group relative overflow-hidden rounded-3xl bg-rajlo-black p-8 text-white shadow-2xl transition-all hover:-translate-y-1 hover:shadow-[0_30px_60px_-15px_rgba(241,1,0,0.35)] md:p-10"
          >
            <ArcWatermark
              size={320}
              variant="white"
              className="absolute -right-16 -bottom-20 opacity-[0.05] transition-opacity group-hover:opacity-[0.09]"
            />
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/85 backdrop-blur">
                <Icon name="navigation" className="h-3.5 w-3.5" />
                Private Ride
              </div>
              <h3 className="text-3xl font-extrabold leading-tight md:text-4xl">
                The whole car.
                <br />
                <span className="text-rajlo-red">Door to door.</span>
              </h3>
              <p className="mt-4 text-base text-white/85">
                You set pickup, dropoff, and as many stops as you need. A
                verified red-plate driver shows up, only for you.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-white/90">
                <Bullet color="white">Up to 4 seats per booking</Bullet>
                <Bullet color="white">Up to 4 intermediate stops</Bullet>
                <Bullet color="white">Live driver position + ETA</Bullet>
                <Bullet color="white">Pay from wallet — never cash</Bullet>
              </ul>
              <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">
                    Typical fare
                  </p>
                  <p className="mt-0.5 text-2xl font-extrabold">From JMD 400</p>
                </div>
                <Link
                  href={cta.riderHref}
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-rajlo-black transition-transform hover:-translate-y-0.5"
                >
                  Book a ride →
                </Link>
              </div>
            </div>
          </article>

          {/* Route Taxi card — red, regulated */}
          <article
            data-anim="card-route"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-rajlo-red via-rajlo-red to-[#c00d0c] p-8 text-white shadow-2xl transition-all hover:-translate-y-1 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.45)] md:p-10"
          >
            <ArcWatermark
              size={320}
              variant="white"
              className="absolute -right-16 -bottom-20 opacity-[0.08] transition-opacity group-hover:opacity-[0.14]"
            />
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
                <Icon name="users" className="h-3.5 w-3.5" />
                Route Taxi
              </div>
              <h3 className="text-3xl font-extrabold leading-tight md:text-4xl">
                Regulated fare.
                <br />
                <span className="text-rajlo-black">Along your corridor.</span>
              </h3>
              <p className="mt-4 text-base text-white/95">
                Flag the next car heading your way. Pay the exact fare published
                by the Transport Authority — no surge, no surprises.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-white">
                <Bullet color="black">TA-licensed routes only</Bullet>
                <Bullet color="black">$113 base + $7/km · rounded to $10</Bullet>
                <Bullet color="black">Hail nearest available driver</Bullet>
                <Bullet color="black">Cashless wallet pay</Bullet>
              </ul>
              <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/20 pt-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                    Sample fare · 8 km
                  </p>
                  <p className="mt-0.5 text-2xl font-extrabold">JMD 170</p>
                </div>
                <Link
                  href={cta.riderHref}
                  className="rounded-full bg-rajlo-black px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                >
                  Hail a route taxi →
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function Bullet({
  children,
  color = "white",
}: {
  children: React.ReactNode;
  color?: "white" | "black";
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full ${
          color === "white" ? "bg-white text-rajlo-red" : "bg-rajlo-black text-white"
        }`}
      >
        <Icon name="check-circle" className="h-2.5 w-2.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

/* ──────────────────────── 3. How It Works ──────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "Sign up in seconds",
    body: "Email + phone. No upfront card details — wallet is funded only when you're ready.",
    icon: "user" as const,
  },
  {
    n: "02",
    title: "Choose how to ride",
    body: "Private ride for door-to-door, route taxi for the corridor you already travel.",
    icon: "navigation" as const,
  },
  {
    n: "03",
    title: "Pay from your wallet",
    body: "Top up once, ride for weeks. Driver gets paid the moment your trip ends.",
    icon: "wallet" as const,
  },
];

function HowItWorks() {
  const ref = useGsap<HTMLElement>((_ctx, root) => {
    gsap.from(root.querySelector("[data-anim='heading']"), {
      scrollTrigger: { trigger: root, start: "top 75%" },
      y: 36,
      opacity: 0,
      duration: 0.7,
      ease: "power3.out",
    });
    gsap.from("[data-anim='step']", {
      scrollTrigger: { trigger: "[data-anim='step-grid']", start: "top 80%" },
      y: 50,
      opacity: 0,
      duration: 0.8,
      stagger: 0.18,
      ease: "expo.out",
    });

    // Animated connecting line that draws as you scroll past the steps.
    const line = root.querySelector<HTMLElement>("[data-anim='line']");
    if (line) {
      gsap.fromTo(
        line,
        { scaleX: 0, transformOrigin: "left center" },
        {
          scaleX: 1,
          duration: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-anim='step-grid']",
            start: "top 75%",
            end: "bottom 60%",
            scrub: 0.4,
          },
        },
      );
    }
  });

  return (
    <section ref={ref} className="relative bg-surface-soft py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div data-anim="heading" className="mb-14 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-rajlo-red">
            How it works
          </p>
          <h2 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            From signup to your first ride —{" "}
            <span className="italic font-light">in minutes.</span>
          </h2>
        </div>

        <div data-anim="step-grid" className="relative">
          {/* Connecting line — desktop only */}
          <div
            aria-hidden
            className="absolute left-[16%] right-[16%] top-12 hidden h-1 rounded-full bg-gradient-to-r from-rajlo-red/0 via-rajlo-red to-rajlo-red/0 md:block"
            data-anim="line"
          />

          <div className="relative grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.n}
                data-anim="step"
                className="relative rounded-3xl border border-line bg-surface p-7 transition-all hover:-translate-y-1 hover:shadow-xl md:p-8"
              >
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rajlo-red text-white shadow-lg shadow-rajlo-red/30">
                    <Icon name={step.icon} className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-3xl font-black text-rajlo-red/15">
                    {step.n}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-extrabold tracking-tight md:text-2xl">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm text-muted md:text-base">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── 4. Fare Transparency ──────────────────────── */

function FareTransparency() {
  const [km, setKm] = useState(8);
  const fare = calculateRouteFare(km);

  const ref = useGsap<HTMLElement>((_ctx, root) => {
    gsap.from(root.querySelector("[data-anim='left']"), {
      scrollTrigger: { trigger: root, start: "top 70%" },
      x: -36,
      opacity: 0,
      duration: 0.9,
      ease: "expo.out",
    });
    gsap.from(root.querySelector("[data-anim='right']"), {
      scrollTrigger: { trigger: root, start: "top 70%" },
      x: 36,
      opacity: 0,
      duration: 0.9,
      ease: "expo.out",
      delay: 0.05,
    });
    gsap.from("[data-anim='formula-token']", {
      scrollTrigger: { trigger: root, start: "top 65%" },
      y: 14,
      opacity: 0,
      duration: 0.5,
      stagger: 0.06,
      delay: 0.4,
      ease: "back.out(1.7)",
    });
  });

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-rajlo-black py-24 text-white md:py-32"
    >
      <ArcWatermark
        size={620}
        variant="red"
        className="absolute -right-32 -top-20 opacity-[0.16]"
      />
      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 md:grid-cols-2">
        <div data-anim="left">
          <p className="text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Fare transparency
          </p>
          <h2 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            We charge what TA quotes.
            <br />
            <span className="italic font-light text-white/85">
              Nothing more.
            </span>
          </h2>
          <p className="mt-5 max-w-xl text-lg text-white/80 md:text-xl">
            Route taxi fares are anchored to the Transport Authority of
            Jamaica&apos;s 2023 schedule. The same formula your tax dollars
            paid to publish — applied per metre, transparently.
          </p>

          <div className="mt-8 inline-flex flex-wrap items-baseline gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 backdrop-blur">
            <span data-anim="formula-token" className="text-sm font-bold uppercase tracking-wider text-white/60">
              Fare =
            </span>
            <span data-anim="formula-token" className="text-2xl font-extrabold">
              $113
            </span>
            <span data-anim="formula-token" className="text-sm text-white/60">
              base
            </span>
            <span data-anim="formula-token" className="text-xl font-bold text-rajlo-red">
              +
            </span>
            <span data-anim="formula-token" className="text-2xl font-extrabold">
              $7
            </span>
            <span data-anim="formula-token" className="text-sm text-white/60">
              × km
            </span>
            <span data-anim="formula-token" className="ml-2 rounded-full bg-rajlo-red/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
              rounded to $10
            </span>
          </div>
        </div>

        {/* Live calculator */}
        <div data-anim="right" className="relative">
          <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-7 backdrop-blur md:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-white/55">
              Try it live
            </p>
            <p className="mt-2 text-2xl font-extrabold">Quote any distance</p>

            <div className="mt-7 flex items-end gap-4">
              <span className="text-7xl font-black tracking-tight tabular-nums">
                {km.toFixed(0)}
                <span className="ml-1 text-2xl font-bold text-white/55">km</span>
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={60}
              step={1}
              value={km}
              onChange={(e) => setKm(Number(e.target.value))}
              aria-label="Distance in kilometres"
              className="mt-5 w-full accent-rajlo-red"
            />

            <div className="mt-7 rounded-2xl border border-rajlo-red/40 bg-rajlo-red/10 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                You&apos;d pay
              </p>
              <p className="mt-1 text-5xl font-black text-white tabular-nums">
                JMD {fare.toLocaleString("en-JM")}
              </p>
              <p className="mt-2 text-xs text-white/65">
                That&apos;s the regulated TA rate. The driver receives 85%; Rajlo
                takes a 15% platform fee.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── 5. Why Rajlo ──────────────────────── */

const PILLARS = [
  {
    title: "Reliability",
    body: "Real-time tracking, route optimisation, and driver transparency every trip.",
    icon: "clock" as const,
  },
  {
    title: "Safety",
    body: "Rigorous TA verification, anonymous chat, and 24/7 incident response.",
    icon: "shield" as const,
  },
  {
    title: "Driver-first",
    body: "Flexible schedules, instant earnings to wallet, no day-end cash reconciliation.",
    icon: "star" as const,
  },
];

function WhyRajlo() {
  const ref = useGsap<HTMLElement>((_ctx, root) => {
    // Counter animation as the strip enters view.
    const counters = root.querySelectorAll<HTMLElement>("[data-counter]");
    counters.forEach((el) => {
      const target = Number(el.dataset.counter ?? "0");
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
        onUpdate: () => {
          el.textContent = Math.round(obj.v).toString();
        },
      });
    });

    gsap.from("[data-anim='pillar']", {
      scrollTrigger: { trigger: "[data-anim='pillar-grid']", start: "top 80%" },
      y: 40,
      opacity: 0,
      duration: 0.8,
      stagger: 0.12,
      ease: "expo.out",
    });
  });

  return (
    <section ref={ref} className="relative bg-background py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-14 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Why Rajlo
          </p>
          <h2 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Built for Jamaica.
            <br />
            <span className="text-rajlo-red">Built for trust.</span>
          </h2>
        </div>

        {/* Counter strip */}
        <div className="mb-14 grid grid-cols-2 gap-6 rounded-3xl border border-line bg-surface p-8 md:grid-cols-4 md:p-10">
          <CounterCell value={14} label="parishes covered" />
          <CounterCell value={10} label="docs verified per driver" />
          <CounterCell value={100} label="red-plate-only" suffix="%" />
          <CounterCell value={0} label="cash transactions" exact="0" />
        </div>

        <div data-anim="pillar-grid" className="grid gap-5 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              data-anim="pillar"
              className="group relative h-full overflow-hidden rounded-3xl border border-line bg-surface p-8 transition-all hover:-translate-y-1 hover:border-rajlo-red hover:shadow-xl"
            >
              <ArcWatermark
                size={260}
                variant="red"
                className="absolute -right-12 -bottom-16 opacity-[0.06] transition-opacity group-hover:opacity-[0.14]"
              />
              <div className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rajlo-red text-white shadow-lg shadow-rajlo-red/25">
                  <Icon name={p.icon} className="h-5 w-5" />
                </span>
                <p className="mt-5 text-2xl font-extrabold tracking-tight">
                  {p.title}
                </p>
                <p className="mt-3 text-base text-muted">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CounterCell({
  value,
  label,
  suffix,
  exact,
}: {
  value: number;
  label: string;
  suffix?: string;
  /** When provided, render this string verbatim instead of animating. */
  exact?: string;
}) {
  return (
    <div className="text-center md:text-left">
      <p className="text-4xl font-extrabold tracking-tight text-rajlo-red md:text-5xl">
        {exact ? (
          <span>{exact}</span>
        ) : (
          <>
            <span data-counter={value}>0</span>
            {suffix}
          </>
        )}
      </p>
      <p className="mt-1 text-sm font-medium text-muted">{label}</p>
    </div>
  );
}

/* ──────────────────────── 6. Drive with Rajlo ──────────────────────── */

function DriveWithRajlo({ cta }: { cta: LandingCtaTargets }) {
  const ref = useGsap<HTMLElement>((_ctx, root) => {
    gsap.from("[data-anim='drive-copy']", {
      scrollTrigger: { trigger: root, start: "top 75%" },
      x: -40,
      opacity: 0,
      duration: 0.9,
      ease: "expo.out",
    });
    gsap.from("[data-anim='drive-card']", {
      scrollTrigger: { trigger: root, start: "top 75%" },
      x: 40,
      opacity: 0,
      duration: 0.9,
      ease: "expo.out",
      delay: 0.1,
    });
    // Earnings number ticks up
    const num = root.querySelector<HTMLElement>("[data-anim='earnings']");
    if (num) {
      const target = Number(num.dataset.target ?? "0");
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.8,
        ease: "power2.out",
        scrollTrigger: { trigger: num, start: "top 85%", once: true },
        onUpdate: () => {
          num.textContent = Math.round(obj.v).toLocaleString("en-JM");
        },
      });
    }
  });

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-surface-soft py-24 md:py-32"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 md:grid-cols-[1.1fr_0.9fr]">
        <div data-anim="drive-copy">
          <p className="text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Drive with Rajlo
          </p>
          <h2 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Keep <span className="text-rajlo-red">85%</span> of every fare.
            <br />
            <span className="italic font-light">Get paid instantly.</span>
          </h2>
          <p className="mt-5 max-w-xl text-lg text-muted md:text-xl">
            No fare splits with a route partner. No end-of-day cash counting.
            Earnings land in your Rajlo wallet the moment a trip ends —
            withdraw to bank when you&apos;re ready.
          </p>
          <ul className="mt-8 grid gap-3 text-sm md:text-base">
            <DriveBullet>Choose Private Ride, Route Taxi, or both</DriveBullet>
            <DriveBullet>Set your own hours — go online when you want</DriveBullet>
            <DriveBullet>Free TA-compliance support during onboarding</DriveBullet>
            <DriveBullet>Driver chat + safety SOS built in</DriveBullet>
          </ul>
          <Link
            href={cta.driverHref}
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-rajlo-black px-7 py-3.5 text-sm font-bold text-white shadow-xl transition-transform hover:-translate-y-0.5"
          >
            {cta.driverIsDashboard ? "Open driver dashboard" : "Apply to drive"}
            <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Earnings example card */}
        <div data-anim="drive-card" className="relative">
          <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-2xl md:p-8">
            <ArcWatermark
              size={300}
              variant="red"
              className="absolute -right-12 -bottom-16 opacity-20"
            />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-wider text-white/55">
                Sample week · 30 trips
              </p>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-sm font-bold text-white/80">JMD</span>
                <span
                  data-anim="earnings"
                  data-target="42500"
                  className="text-6xl font-black tabular-nums tracking-tight md:text-7xl"
                >
                  0
                </span>
              </p>
              <p className="mt-2 text-sm text-white/65">
                in driver earnings — straight to your wallet
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3 text-sm">
                <Stat label="Avg fare" value="JMD 1,665" />
                <Stat label="Trips/week" value="30" />
                <Stat label="Your share" value="85%" highlight />
                <Stat label="Wallet payout" value="Instant" highlight />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DriveBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rajlo-red text-white">
        <Icon name="check-circle" className="h-3 w-3" />
      </span>
      <span>{children}</span>
    </li>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-rajlo-red/50 bg-rajlo-red/15"
          : "border-white/10 bg-white/5"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">
        {label}
      </p>
      <p className="mt-1 text-base font-extrabold">{value}</p>
    </div>
  );
}

/* ──────────────────────── 7. Final CTA ──────────────────────── */

function FinalCta({ cta }: { cta: LandingCtaTargets }) {
  const ref = useGsap<HTMLElement>((_ctx, root) => {
    gsap.from(root.querySelector("[data-anim='cta-title']"), {
      scrollTrigger: { trigger: root, start: "top 80%" },
      scale: 0.92,
      opacity: 0,
      duration: 0.9,
      ease: "expo.out",
    });
    gsap.from("[data-anim='cta-btn']", {
      scrollTrigger: { trigger: root, start: "top 75%" },
      y: 20,
      opacity: 0,
      duration: 0.7,
      stagger: 0.1,
      ease: "power3.out",
      delay: 0.3,
    });
    // Big logo subtle pulse
    gsap.to(root.querySelector("[data-anim='cta-logo']"), {
      scale: 1.04,
      duration: 2.4,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  });

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-rajlo-red py-28 text-center text-white md:py-36"
    >
      <ArcWatermark
        size={780}
        variant="white"
        className="absolute -left-40 -bottom-40 opacity-[0.08]"
      />
      <ArcWatermark
        size={620}
        variant="white"
        className="absolute -right-32 -top-24 opacity-[0.06]"
      />
      <div className="relative mx-auto max-w-3xl px-4">
        {/* Big white wordmark — drops the brand-coloured icon mark in
           favour of the full Logo set to the white variant so the
           "Rajl" + "o" reads cleanly on the red background. */}
        <div data-anim="cta-logo" className="mb-7 inline-block">
          <Logo size="xl" variant="white" tagline={false} href={null} />
        </div>
        <h2
          data-anim="cta-title"
          className="text-5xl font-black leading-[0.98] tracking-tight md:text-7xl"
        >
          Ready to ride?
          <br />
          <span className="italic font-light">Let&apos;s go!</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-white/85">
          Sign up in under a minute. Top up when you&apos;re ready. Move across
          Jamaica without ever touching cash.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            data-anim="cta-btn"
            href={cta.riderHref}
            className="rounded-full bg-rajlo-black px-9 py-4 text-base font-bold text-white shadow-2xl shadow-black/40 transition-transform hover:-translate-y-0.5"
          >
            {cta.riderIsDashboard
              ? "Open my dashboard →"
              : "Get started — it's free →"}
          </Link>
          <Link
            data-anim="cta-btn"
            href={cta.driverHref}
            className="rounded-full border-2 border-white/85 px-9 py-4 text-base font-bold text-white transition-colors hover:bg-white/10"
          >
            {cta.driverIsDashboard ? "Driver dashboard" : "Drive with Rajlo"}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ScrollTrigger import-side-effect is here purely so tree-shakers don't
// drop the plugin when the only usage is via the registered plugin object
// inside use-gsap.ts.
void ScrollTrigger;
