"use client";

import Link from "next/link";
import { useState } from "react";

export default function LiveTripPage() {
  const [showShare, setShowShare] = useState(false);

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
          <p className="text-muted text-sm">Live Map View</p>
        </div>
      </div>

      {/* Driver Info Card */}
      <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold">
            A
          </div>
          <div className="flex-1">
            <p className="font-semibold">Andre Thompson</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm">⭐ 4.8</span>
              <span className="text-xs text-muted">• 342 rides</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">Toyota Axio</p>
            <p className="text-xs text-muted">5812 GK</p>
          </div>
        </div>
      </div>

      {/* Trip Details */}
      <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-3">
            Trip Details
          </p>
          <div className="space-y-4">
            {/* Pickup */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <div className="h-8 w-0.5 bg-line my-1" />
              </div>
              <div className="flex-1 pb-2">
                <p className="text-xs text-muted">Pickup</p>
                <p className="font-medium">Cross Roads, Kingston</p>
              </div>
            </div>

            {/* Dropoff */}
            <div className="flex gap-3">
              <div>
                <div className="h-3 w-3 rounded-full bg-surface-soft border-2 border-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted">Dropoff</p>
                <p className="font-medium">Half-Way Tree, St. Andrew</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted mb-1">ETA</p>
              <p className="text-2xl font-bold text-primary">11</p>
              <p className="text-xs text-muted">minutes</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Distance</p>
              <p className="text-2xl font-bold">3.2</p>
              <p className="text-xs text-muted">km</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Fare</p>
              <p className="text-2xl font-bold text-primary">JMD 580</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trip Controls */}
      <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 space-y-3">
        <button
          onClick={() => setShowShare(!showShare)}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-surface-soft hover:bg-primary/5 py-3 font-medium text-sm transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Share Trip Status
        </button>

        {showShare && (
          <div className="rounded-lg border border-line bg-surface-soft p-3 space-y-2">
            <p className="text-sm font-medium">Share with trusted contacts:</p>
            <div className="flex gap-2">
              {["Mom", "Dad", "Sister"].map((contact) => (
                <button
                  key={contact}
                  className="flex-1 rounded border border-line bg-surface py-2 text-xs font-medium hover:bg-primary hover:text-white transition-colors"
                >
                  {contact}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-line hover:bg-surface-soft py-3 font-medium text-sm transition-colors">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
          </svg>
          Call Driver
        </button>

        <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 py-3 font-medium text-sm transition-colors">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          </svg>
          Report Issue
        </button>
      </div>

      {/* Trip Complete CTA */}
      <Link
        href="/rider/confirmation"
        className="block rounded-lg bg-emerald-500 py-4 font-semibold text-white hover:opacity-90 transition-opacity text-center text-lg"
      >
        End Trip (Arriving)
      </Link>
    </div>
  );
}
