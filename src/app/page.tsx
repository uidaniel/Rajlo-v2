"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line/50 bg-surface/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">RAJLO</span>
            <span className="text-xs text-muted font-medium hidden sm:inline">Let's go!</span>
          </div>
          <div className="flex gap-3">
            <Link
              href="/auth/rider/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
            >
              Rider Sign In
            </Link>
            <Link
              href="/auth/driver/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
            >
              Driver Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <p className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary uppercase tracking-wide mb-4">
            Let's go!
          </p>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Get where you need to go with <span className="text-primary">RAJLO</span>
          </h1>
          <p className="text-lg text-muted mb-8 max-w-2xl mx-auto">
            RAJLO — Let's go! A reliable rideshare platform built for Jamaica with verified red plate drivers, transparent parish-based pricing, and multi-seat bookings.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/rider/signup"
              className="rounded-lg bg-primary px-8 py-4 font-semibold text-white hover:opacity-90 transition-opacity text-lg"
            >
              Book a Ride
            </Link>
            <Link
              href="/driver-join"
              className="rounded-lg border border-line bg-surface px-8 py-4 font-semibold hover:bg-surface-soft transition-colors text-lg"
            >
              Become a Driver
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Why Choose RAJLO?
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: "✅",
              title: "Verified Drivers",
              description: "All drivers verified against Jamaica's Transportation Authority",
            },
            {
              icon: "📍",
              title: "Parish-Based Pricing",
              description: "Fair, transparent pricing based on your route and demand",
            },
            {
              icon: "🪑",
              title: "Multi-Seat Booking",
              description: "Book 1-4 seats for individuals or small groups",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="rounded-2xl border border-line bg-surface p-6 md:p-8 hover:shadow-lg transition-shadow"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Portal Overview */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Explore RAJLO
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Rider Portal",
              desc: "Request rides, track drivers, and manage bookings",
              links: [
                ["Request a Ride", "/rider/request"],
                ["View History", "/rider/history"],
                ["Live Tracking", "/rider/live-trip"],
              ],
            },
            {
              title: "Driver Portal",
              desc: "Accept rides, verify status, and track earnings",
              links: [
                ["Check Requests", "/driver"],
                ["Active Trip", "/driver/active-trip"],
                ["Earnings", "/driver/earnings"],
              ],
            },
            {
              title: "Admin Portal",
              desc: "Manage verification, pricing, and operations",
              links: [
                ["Admin Home", "/admin"],
                ["Verification", "/admin/verification-queue"],
                ["Fare Rules", "/admin/fare-rules"],
              ],
            },
          ].map((portal, i) => (
            <div
              key={i}
              className="rounded-2xl border border-line bg-surface p-6 md:p-8 space-y-4"
            >
              <h3 className="text-xl font-semibold">{portal.title}</h3>
              <p className="text-sm text-muted">{portal.desc}</p>
              <div className="flex flex-wrap gap-2 pt-4 border-t border-line">
                {portal.links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-xs font-medium rounded-full bg-primary/10 text-primary px-3 py-1.5 hover:bg-primary hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 py-12 md:py-16 border-t border-line/50 mt-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <p className="font-bold text-primary mb-3">RAJLO</p>
            <p className="text-sm text-muted">Let's go! Jamaica's trusted rideshare platform.</p>
          </div>
          {[
            { title: "Company", links: ["About", "Blog", "Careers"] },
            { title: "Support", links: ["Help Center", "Contact", "Safety"] },
            { title: "Legal", links: ["Terms", "Privacy", "Licenses"] },
          ].map((col, i) => (
            <div key={i}>
              <p className="font-semibold text-sm mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <button className="text-sm text-muted hover:text-foreground">
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-line/50 pt-8 text-center text-sm text-muted">
          <p>&copy; 2026 RAJLO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

