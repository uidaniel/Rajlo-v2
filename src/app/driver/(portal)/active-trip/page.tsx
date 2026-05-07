"use client";

import Link from "next/link";

export default function DriverActiveTripPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Map Placeholder */}
      <div className="rounded-2xl border border-line bg-surface-soft h-64 md:h-96 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-primary to-transparent" />
        <div className="text-center relative z-10">
          <svg
            className="h-16 w-16 text-primary/40 mx-auto mb-2"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8m0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5" />
          </svg>
          <p className="text-muted text-sm">Navigation Map</p>
        </div>
      </div>

      {/* Rider Info */}
      <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted font-semibold">Passenger</p>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-semibold">
            J
          </div>
          <div className="flex-1">
            <p className="font-semibold">Joan Smith</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm">⭐ 4.9</span>
            </div>
          </div>
          <button className="rounded p-2 hover:bg-surface-soft">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Trip Status */}
      <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted font-semibold">Trip Progress</p>

        <div className="space-y-4">
          {/* Pickup */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <div className="h-12 w-0.5 bg-line my-1" />
            </div>
            <div className="flex-1 pb-4">
              <p className="text-xs text-muted">PICKUP LOCATION</p>
              <p className="font-medium">Cross Roads, Kingston</p>
              <p className="text-xs text-muted mt-1">Arrived 2 mins ago</p>
            </div>
          </div>

          {/* Dropoff */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-3 w-3 rounded-full border-2 border-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted">DROPOFF LOCATION</p>
              <p className="font-medium">Half-Way Tree, St. Andrew</p>
              <p className="text-xs text-muted mt-1">ETA 8 mins</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trip Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Passengers", value: "1" },
          { label: "ETA", value: "8 min" },
          { label: "Fare", value: "JMD 580" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line bg-surface-soft p-3 text-center">
            <p className="text-xs text-muted mb-1">{stat.label}</p>
            <p className="font-bold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button className="w-full flex items-center justify-center gap-2 rounded-lg bg-surface-soft hover:bg-primary/5 py-3 font-medium text-sm transition-colors">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
          </svg>
          Call Passenger
        </button>

        <Link
          href="/driver/trip-complete"
          className="block rounded-lg bg-emerald-500 py-3 font-semibold text-white hover:opacity-90 transition-opacity text-center"
        >
          Complete Trip
        </Link>
      </div>
    </div>
  );
}
