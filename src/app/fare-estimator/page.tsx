"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MarketingShell } from "@/components/marketing-shell";
import { ArcWatermark } from "@/components/arc-pattern";
import { parishes } from "@/lib/mock-data";

/**
 * Mock fare logic — replaced by real engine in Phase 3.
 * Pseudo-deterministic: same inputs always produce same output.
 */
function estimateFare(origin: string, dest: string, seats: number) {
  const base = 350;
  const perChar = (origin.length + dest.length) * 12;
  const seatMultiplier = 1 + (seats - 1) * 0.4;
  const subtotal = (base + perChar) * seatMultiplier;
  const platformFee = subtotal * 0.08;
  const total = subtotal + platformFee;
  return {
    base,
    distance: perChar,
    seats: subtotal - base - perChar,
    platformFee,
    total,
  };
}

export default function FareEstimatorPage() {
  const [origin, setOrigin] = useState("Kingston");
  const [dest, setDest] = useState("St. Andrew");
  const [seats, setSeats] = useState(1);

  const fare = useMemo(
    () => estimateFare(origin, dest, seats),
    [origin, dest, seats],
  );

  return (
    <MarketingShell>
      <section className="relative overflow-hidden bg-rajlo-red py-16 text-white">
        <ArcWatermark
          size={520}
          variant="white"
          className="absolute -right-20 -bottom-24"
        />
        <div className="relative mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
            Transparent pricing
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            See your fare before you book.
          </h1>
          <p className="mt-3 max-w-2xl text-white/90">
            Parish-aware rates with no surge surprises — Jamaica-wide.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          {/* Inputs */}
          <div className="rounded-2xl border border-line bg-surface p-6 md:p-8">
            <h2 className="text-xl font-bold tracking-tight">Plan your trip</h2>
            <div className="mt-6 space-y-5">
              <ParishSelect
                label="Pickup parish"
                value={origin}
                onChange={setOrigin}
              />
              <ParishSelect
                label="Dropoff parish"
                value={dest}
                onChange={setDest}
              />

              <div>
                <p className="mb-2 block text-sm font-semibold">Seats</p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSeats(n)}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                        seats === n
                          ? "border-rajlo-red bg-primary-soft text-rajlo-red"
                          : "border-line bg-surface text-foreground hover:bg-surface-soft"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="relative overflow-hidden rounded-2xl bg-rajlo-black p-6 text-white md:p-8">
            <ArcWatermark
              size={300}
              variant="white"
              className="absolute -right-12 -bottom-16"
            />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Estimated total
              </p>
              <p className="mt-1 text-5xl font-extrabold">
                JMD {Math.round(fare.total)}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {origin} → {dest} · {seats} seat{seats > 1 ? "s" : ""}
              </p>

              <ul className="mt-6 space-y-2 text-sm">
                <Row label="Base fare" value={fare.base} />
                <Row label="Distance" value={fare.distance} />
                {seats > 1 && <Row label="Multi-seat" value={fare.seats} />}
                <Row label="Platform fee" value={fare.platformFee} />
              </ul>

              <Link
                href="/auth/rider/signup"
                className="mt-7 block rounded-full bg-white py-3 text-center text-sm font-semibold text-rajlo-black hover:bg-white/95"
              >
                Sign up to book this ride
              </Link>
              <p className="mt-3 text-center text-xs text-white/50">
                Final fare confirmed before trip starts. Estimate only.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function ParishSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
      >
        {parishes.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between border-b border-white/10 pb-2">
      <span className="text-white/70">{label}</span>
      <span className="font-semibold">JMD {Math.round(value)}</span>
    </li>
  );
}
