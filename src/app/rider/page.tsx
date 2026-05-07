"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp, Stagger, StaggerItem } from "@/components/anim";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { formatJMD } from "@/lib/jamaica";

/**
 * Rider home / dashboard. Designed to make booking feel inevitable —
 * single big hero CTA, one-tap re-book chips, recent rides at a glance.
 *
 * Phase 2 will replace the mock active trip + recent rides with real data
 * from the `rides` table once the booking backend lands.
 */

type SavedDestination = {
  label: string;
  address: string;
  icon: IconName;
  estimateJMD: number;
  travelTime: string;
};

const QUICK_DESTINATIONS: SavedDestination[] = [
  {
    label: "Norman Manley Airport",
    address: "Palisadoes, Kingston",
    icon: "navigation",
    estimateJMD: 2400,
    travelTime: "32 min",
  },
  {
    label: "Half-Way Tree",
    address: "Constant Spring Rd, St. Andrew",
    icon: "map-pin",
    estimateJMD: 580,
    travelTime: "11 min",
  },
  {
    label: "New Kingston",
    address: "Knutsford Blvd, Kingston",
    icon: "map-pin",
    estimateJMD: 720,
    travelTime: "14 min",
  },
  {
    label: "Sangster Int'l Airport",
    address: "Sunset Drive, St. James",
    icon: "navigation",
    estimateJMD: 9800,
    travelTime: "3 hr 10 min",
  },
];

const RECENT_RIDES = [
  {
    from: "Hope Road",
    to: "Devon House",
    when: "Yesterday · 6:14 PM",
    fareJMD: 480,
  },
  {
    from: "Cross Roads",
    to: "Half-Way Tree",
    when: "Tue · 8:02 AM",
    fareJMD: 620,
  },
  {
    from: "Spanish Town",
    to: "Portmore Toll",
    when: "Last Sat · 10:31 AM",
    fareJMD: 1240,
  },
];

// Mocked active trip — will be wired to Supabase once the rides table lands.
const ACTIVE_TRIP = null as null | {
  driverName: string;
  driverRating: number;
  vehicle: string;
  plate: string;
  etaMin: number;
  pickup: string;
  dropoff: string;
};

export default function RiderDashboardPage() {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      const name = data?.full_name?.split(" ")[0] ?? null;
      setFirstName(name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = firstName ? `Hi, ${firstName}` : "Hey there";

  return (
    <div className="space-y-6">
      {/* ============== HERO ============== */}
      <FadeUp>
        <section className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-xl shadow-rajlo-black/30 md:p-10">
          {/* Brand bloom + arc watermarks */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(circle at 100% 0%, rgba(241,1,0,0.35) 0%, rgba(241,1,0,0) 45%), radial-gradient(circle at 0% 100%, rgba(241,1,0,0.18) 0%, rgba(241,1,0,0) 40%)",
            }}
          />
          <ArcWatermark
            size={520}
            variant="white"
            className="absolute -right-24 -top-24 opacity-[0.06]"
          />
          <ArcWatermark
            size={360}
            variant="red"
            className="absolute -left-20 -bottom-24 opacity-[0.16]"
          />

          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                {greeting}
              </span>
              <span className="h-px flex-1 bg-white/15" />
            </div>
            <h1 className="mt-3 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              Where to{" "}
              <span className="bg-gradient-to-r from-rajlo-red via-[#ff4d4d] to-rajlo-red bg-clip-text text-transparent">
                today?
              </span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/75 md:text-base">
              Verified red-plate drivers, transparent fares, multi-stop trips —
              tap once and ride.
            </p>

            {/* Search-style entry that routes to /rider/request */}
            <Link
              href="/rider/request"
              className="group mt-7 inline-flex w-full items-center gap-3 rounded-2xl bg-white p-2 pl-5 text-left shadow-2xl shadow-black/30 transition-all hover:-translate-y-0.5 hover:shadow-rajlo-red/30 sm:max-w-md"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-rajlo-red">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Where to?
                </span>
                <span className="block truncate text-sm font-bold text-rajlo-black">
                  Search a place, address, or landmark
                </span>
              </span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rajlo-red text-white shadow-md shadow-rajlo-red/30 transition-transform group-hover:translate-x-0.5">
                <Icon name="arrow-right" className="h-4 w-4" />
              </span>
            </Link>

            {/* Trust strip */}
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-white/75">
              <TrustChip icon="shield-check" label="TA-verified drivers" />
              <TrustChip icon="check-circle" label="Upfront fares" />
              <TrustChip icon="users" label="Multi-stop & shared" />
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ============== ACTIVE TRIP (if any) ============== */}
      {ACTIVE_TRIP && (
        <FadeUp delay={0.05}>
          <Link
            href="/rider/live-trip"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-rajlo-red/30 bg-gradient-to-br from-primary-soft to-white p-5 transition-all hover:-translate-y-0.5 hover:border-rajlo-red hover:shadow-lg"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rajlo-red text-white shadow-md shadow-rajlo-red/30">
              <Icon name="navigation" className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                  Live trip
                </span>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rajlo-red opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rajlo-red" />
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm font-bold">
                {ACTIVE_TRIP.driverName} · {ACTIVE_TRIP.vehicle}{" "}
                <span className="text-muted">({ACTIVE_TRIP.plate})</span>
              </p>
              <p className="truncate text-xs text-muted">
                Heading to {ACTIVE_TRIP.dropoff} · ETA {ACTIVE_TRIP.etaMin} min
              </p>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-soft text-muted transition-all group-hover:bg-rajlo-red group-hover:text-white">
              <Icon name="chevron-right" className="h-4 w-4" />
            </span>
          </Link>
        </FadeUp>
      )}

      {/* ============== QUICK DESTINATIONS ============== */}
      <FadeUp delay={0.1}>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-secondary text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
              Quick book
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">
              Popular trips, ready to roll
            </h2>
          </div>
          <Link
            href="/rider/request"
            className="hidden text-xs font-bold text-rajlo-red hover:underline sm:inline-flex"
          >
            Plan custom →
          </Link>
        </div>
      </FadeUp>

      <Stagger className="grid gap-3 sm:grid-cols-2" amount={0.05}>
        {QUICK_DESTINATIONS.map((dest) => (
          <StaggerItem key={dest.label}>
            <Link
              href="/rider/request"
              className="group relative flex h-full items-stretch overflow-hidden rounded-2xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-rajlo-red hover:shadow-lg hover:shadow-rajlo-red/10"
            >
              {/* Side accent bar */}
              <span
                aria-hidden
                className="w-1 shrink-0 bg-gradient-to-b from-rajlo-red via-rajlo-red/70 to-rajlo-red/30"
              />
              <div className="flex min-w-0 flex-1 items-center gap-3 p-4 md:p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-rajlo-red transition-colors group-hover:bg-rajlo-red group-hover:text-white">
                  <Icon name={dest.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold tracking-tight">
                    {dest.label}
                  </p>
                  <p className="truncate text-xs text-muted">{dest.address}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className="font-bold text-rajlo-red">
                      from {formatJMD(dest.estimateJMD)}
                    </span>
                    <span className="text-muted">·</span>
                    <span className="font-medium text-muted">
                      {dest.travelTime}
                    </span>
                  </div>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-soft text-muted transition-all group-hover:bg-rajlo-red group-hover:text-white">
                  <Icon name="arrow-right" className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      {/* ============== RECENT TRIPS ============== */}
      <FadeUp delay={0.15}>
        <div className="mb-3 mt-6 flex items-end justify-between">
          <div>
            <p className="font-secondary text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
              Take it again
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">
              Your recent trips
            </h2>
          </div>
          <Link
            href="/rider/history"
            className="text-xs font-bold text-rajlo-red hover:underline"
          >
            See all →
          </Link>
        </div>
      </FadeUp>

      <Stagger className="space-y-2.5" amount={0.04}>
        {RECENT_RIDES.map((r, i) => (
          <StaggerItem key={`${r.from}-${r.to}-${i}`}>
            <Link
              href="/rider/request"
              className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-rajlo-red hover:shadow-md"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-soft text-muted group-hover:bg-primary-soft group-hover:text-rajlo-red">
                <Icon name="clock" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {r.from} <span className="text-rajlo-red">→</span> {r.to}
                </p>
                <p className="truncate text-[11px] text-muted">{r.when}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-foreground">
                  {formatJMD(r.fareJMD)}
                </p>
                <p className="text-[10px] text-muted">tap to rebook</p>
              </div>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-all group-hover:bg-rajlo-red group-hover:text-white">
                <Icon name="chevron-right" className="h-3.5 w-3.5" />
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      {/* ============== STATS STRIP ============== */}
      <FadeUp delay={0.2}>
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-rajlo-black via-rajlo-black to-[#1a1d10] p-6 text-white">
          <div className="grid grid-cols-3 divide-x divide-white/10">
            <Stat label="Trips" value="24" />
            <Stat label="Rating" value="4.9" suffix="★" />
            <Stat label="CO₂ saved" value="320" suffix=" kg" />
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-white/55">
            Multi-seat shared rides cut emissions vs. driving solo. Every trip
            you take with someone else is one less car on the road.
          </p>
        </div>
      </FadeUp>

      {/* ============== REFERRAL ============== */}
      <FadeUp delay={0.25}>
        <Link
          href="/rider/settings"
          className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-rajlo-red/30 bg-primary-soft p-5 transition-all hover:-translate-y-0.5 hover:border-rajlo-red hover:shadow-lg"
        >
          <ArcWatermark
            size={220}
            variant="red"
            className="pointer-events-none absolute -right-12 -bottom-12 opacity-20"
          />
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rajlo-red text-white shadow-md shadow-rajlo-red/30">
            <Icon name="users" className="h-5 w-5" />
          </span>
          <div className="relative min-w-0 flex-1">
            <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
              Refer a friend
            </p>
            <p className="mt-0.5 text-sm font-extrabold tracking-tight md:text-base">
              Get JMD 500 in credit when they take their first ride
            </p>
            <p className="hidden text-xs text-rajlo-black/70 sm:block">
              Share your invite link · they save · you save
            </p>
          </div>
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-rajlo-red transition-all group-hover:bg-rajlo-red group-hover:text-white">
            <Icon name="arrow-right" className="h-4 w-4" />
          </span>
        </Link>
      </FadeUp>
    </div>
  );
}

/* ─────────── Inline subcomponents ─────────── */

function TrustChip({ icon, label }: { icon: IconName; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-white/85">
        <Icon name={icon} className="h-3 w-3" />
      </span>
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="px-3 text-center first:pl-0 last:pr-0">
      <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-white/55">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
        {value}
        {suffix && <span className="text-sm font-bold text-white/70">{suffix}</span>}
      </p>
    </div>
  );
}
