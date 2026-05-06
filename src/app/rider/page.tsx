"use client";

import Link from "next/link";
import { RideRequestCard } from "@/components/ride-request-card";

export default function RiderDashboardPage() {
  const activeRide = {
    id: "ride-001",
    from: "Cross Roads, Kingston",
    to: "Half-Way Tree, St. Andrew",
    eta: "11 mins",
    price: "JMD 580",
    seats: 2,
    driver: {
      name: "Andre Thompson",
      rating: 4.8,
      vehicle: "Toyota Axio",
      plate: "5812 GK",
    },
    status: "en_route" as const,
  };

  return (
    <div className="space-y-6">
      {/* Hero Request Section */}
      <div className="rounded-2xl border border-line bg-gradient-to-br from-primary/10 to-primary/5 p-6 md:p-8">
        <div className="mb-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">
            Ready to Ride?
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">
            Where are we<br className="hidden md:block" /> going today?
          </h1>
        </div>
        <Link
          href="/rider/request"
          className="inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Request a Ride
        </Link>
      </div>

      {/* Active Ride */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold">Active Ride</h2>
          <Link href="/rider/history" className="text-sm text-primary hover:underline">
            View History
          </Link>
        </div>
        <RideRequestCard ride={activeRide} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "My Rides", href: "/rider/history", icon: "🚗" },
          { label: "Payments", href: "/rider/payments", icon: "💳" },
          { label: "Safety", href: "/rider/safety", icon: "🛡️" },
          { label: "Settings", href: "/rider/settings", icon: "⚙️" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-xl border border-line bg-surface p-4 text-center hover:bg-surface-soft transition-colors"
          >
            <div className="text-2xl mb-2">{action.icon}</div>
            <p className="text-xs font-medium">{action.label}</p>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-3">
        {[
          { label: "Completed Rides", value: "24" },
          { label: "Your Rating", value: "4.9" },
          { label: "Savings", value: "JMD 2.1K" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-surface p-4 text-center">
            <p className="text-xs text-muted mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}