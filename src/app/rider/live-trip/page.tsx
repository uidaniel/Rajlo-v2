"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { MapView } from "@/components/map-view";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRidePosition } from "@/lib/use-ride-position";
import { SafetySheet } from "@/components/safety-sheet";
import { formatJMD, type Place } from "@/lib/jamaica";

/**
 * Rider's live-trip view.
 *
 * Shows the rider's current ride (in any state from `requested` through
 * `in_progress`) with the assigned driver's card + a status banner that
 * reflects the driver's actions (en-route → arrived at pickup →
 * trip in progress).
 *
 * Polls /api/rider/rides/active every 5s for now; Phase 2A.2 follow-up
 * swaps to a Supabase Realtime subscription.
 */

type ActiveRide = {
  id: string;
  status:
    | "requested"
    | "accepted"
    | "arrived"
    | "in_progress"
    | "completed"
    | "cancelled";
  pickup: { name: string; address: string; lat: number; lng: number };
  dropoff: { name: string; address: string; lat: number; lng: number };
  stops: { position: number; name: string; address: string; lat: number; lng: number }[];
  seats: number;
  notes: string | null;
  estimatedFareJMD: number;
  estimatedDistanceKm: number | null;
  estimatedEtaMinutes: number | null;
  timeline: {
    requestedAt: string | null;
    acceptedAt: string | null;
    arrivedAt: string | null;
    startedAt: string | null;
  };
};

type DriverInfo = {
  name: string;
  plateNumber: string | null;
  vehicle: string | null;
  rating: number;
  avatarUrl: string | null;
};

type ActiveResponse = {
  ride: ActiveRide | null;
  driver: DriverInfo | null;
};

const STATUS_HERO: Record<
  ActiveRide["status"],
  { eyebrow: string; title: string; description: string; tone: "red" | "amber" | "emerald" }
> = {
  requested: {
    eyebrow: "Looking for a driver",
    title: "We're matching you with a nearby driver…",
    description:
      "Hold tight — verified red-plate drivers are being notified right now.",
    tone: "red",
  },
  accepted: {
    eyebrow: "Driver on the way",
    title: "Your driver is heading to the pickup",
    description: "Watch for them at the pickup spot.",
    tone: "amber",
  },
  arrived: {
    eyebrow: "Driver at pickup",
    title: "Your driver is here",
    description: "Hop in when you're ready.",
    tone: "emerald",
  },
  in_progress: {
    eyebrow: "Trip in progress",
    title: "On your way",
    description: "Sit back and enjoy the ride.",
    tone: "emerald",
  },
  completed: {
    eyebrow: "Trip complete",
    title: "Thanks for riding with Rajlo",
    description: "Hope you had a smooth trip.",
    tone: "emerald",
  },
  cancelled: {
    eyebrow: "Cancelled",
    title: "This trip was cancelled",
    description: "Book another ride from your dashboard.",
    tone: "red",
  },
};

export default function RiderLiveTripPage() {
  const [data, setData] = useState<ActiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);

  // Live tracking: rider streams their own GPS so the driver can find them,
  // and the hook surfaces the driver's incoming pings as `driverPosition`.
  // We only stream while the trip is active (not before a driver accepts —
  // no point telling a non-existent driver where you are).
  const activeRideId = data?.ride?.id ?? null;
  const trackingActive =
    !!data?.ride &&
    ["accepted", "arrived", "in_progress"].includes(data.ride.status);
  const { driverPosition, riderPosition, geoError } = useRidePosition(
    trackingActive ? activeRideId : null,
    "rider",
    /* streamSelf */ trackingActive,
  );

  // Pulled out so the Realtime subscription effect can call it without
  // recreating the function (and without re-subscribing on every
  // change). Reads the rider's active ride + assigned driver from the
  // server — used both for the initial fetch and for every postgres_changes
  // push, so we always render the latest joined data, not just whatever
  // came through the row payload.
  const refresh = async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/rider/rides/active", { signal });
      if (!res.ok) return;
      const json = (await res.json()) as ActiveResponse;
      setData(json);
    } catch (err) {
      // AbortError is expected when the effect unmounts — swallow it.
      if ((err as { name?: string })?.name === "AbortError") return;
      /* other network blip — Realtime will fire another refresh shortly */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    refresh(ac.signal);

    // Subscribe to any change on the rider's own rides. RLS gates this
    // to the signed-in user's rows so we don't need a filter — but the
    // active ride id isn't known until the first fetch resolves, and a
    // global rides-table subscription is fine because each rider only
    // ever sees their own. We re-fetch from the server on every push so
    // the joined driver profile (plate, avatar, etc.) stays in sync.
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("rider-live-trip")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      ac.abort();
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCancel = async () => {
    if (!data?.ride) return;
    if (!confirm("Cancel this ride?")) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/rider/rides/${data.ride.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Server returned ${res.status}`);
      }
      // The next poll will pick up the cancelled state. Optimistic update:
      setData((prev) =>
        prev?.ride
          ? {
              ride: { ...prev.ride, status: "cancelled" },
              driver: prev.driver,
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel ride");
    } finally {
      setCancelling(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="grid place-items-center px-4 py-16">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-rajlo-red border-t-transparent" />
          Loading your trip…
        </div>
      </div>
    );
  }

  /* ── No active trip ── */
  if (!data?.ride) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-soft text-muted">
          <Icon name="navigation" className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
          No active trip
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Book a ride to get started.
        </p>
        <Link
          href="/rider/request"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white hover:bg-primary-hover"
        >
          Book a ride
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const { ride, driver } = data;
  const hero = STATUS_HERO[ride.status];

  // Map: while waiting/en-route show the full route (rider sees pickup +
  // dropoff). Once the trip is in_progress, dropoff is the destination.
  const mapPickup: Place = {
    placeId: "",
    name: ride.pickup.name,
    address: ride.pickup.address,
    lat: ride.pickup.lat,
    lng: ride.pickup.lng,
    parish: null,
  };
  const mapDropoff: Place = {
    placeId: "",
    name: ride.dropoff.name,
    address: ride.dropoff.address,
    lat: ride.dropoff.lat,
    lng: ride.dropoff.lng,
    parish: null,
  };
  const mapStops: Place[] = ride.stops.map((s) => ({
    placeId: "",
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    parish: null,
  }));

  const driverInitials = driver?.name
    ? driver.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("")
    : "?";

  const isTerminal = ride.status === "completed" || ride.status === "cancelled";
  const canCancel = ["requested", "accepted", "arrived"].includes(ride.status);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6 md:py-8">
      <FadeUp>
        <div
          className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl md:p-8 ${
            hero.tone === "emerald"
              ? "bg-emerald-600 shadow-emerald-600/30"
              : hero.tone === "amber"
                ? "bg-rajlo-black shadow-rajlo-black/30"
                : "bg-rajlo-red shadow-rajlo-red/30"
          }`}
        >
          <ArcWatermark
            size={360}
            variant="white"
            className="absolute -right-20 -bottom-24 opacity-[0.10]"
          />
          <div className="relative">
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-white/85">
              {hero.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
              {hero.title}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/85">
              {hero.description}
            </p>
            {ride.status === "accepted" && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                Live · driver heading to you
              </div>
            )}
          </div>
        </div>
      </FadeUp>

      {error && (
        <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
          {error}
        </div>
      )}
      {geoError && trackingActive && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          {geoError} Sharing your live position helps your driver find you.
        </div>
      )}

      <FadeUp delay={0.05}>
        <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-lg shadow-rajlo-red/[0.04]">
          {/* Live-tracking is the primary task on this page, so let the
             map dominate. `h-[55vh]` scales with the device — about half
             the viewport on phones, comfortable on desktop. */}
          <MapView
            pickup={mapPickup}
            stops={mapStops}
            dropoff={mapDropoff}
            driverPosition={driverPosition}
            riderPosition={riderPosition}
            className="h-[55vh] min-h-[20rem] w-full md:h-[60vh] md:max-h-[640px]"
          />
        </div>
      </FadeUp>

      {driver && (
        <FadeUp delay={0.1}>
          <div className="flex items-center gap-4 rounded-2xl border border-rajlo-red/30 bg-primary-soft p-5">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-base font-extrabold text-rajlo-red ring-1 ring-rajlo-red/20">
              {driver.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={driver.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                driverInitials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                Your driver
              </p>
              <p className="mt-0.5 truncate text-base font-extrabold tracking-tight">
                {driver.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {driver.vehicle ?? "Red plate vehicle"}
                {driver.plateNumber ? ` · ${driver.plateNumber}` : ""}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-rajlo-red">
                <Icon name="star" className="h-3 w-3" />
                {driver.rating.toFixed(1)}
              </p>
            </div>
          </div>
        </FadeUp>
      )}

      {/* Trip details */}
      <FadeUp delay={0.15}>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-[11px] font-extrabold text-white">
              A
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                Pickup
              </p>
              <p className="mt-0.5 truncate text-sm font-bold">
                {ride.pickup.name}
              </p>
              <p className="truncate text-xs text-muted">
                {ride.pickup.address}
              </p>
            </div>
          </div>

          {ride.stops.map((s) => (
            <div key={s.position} className="mt-4 flex items-start gap-3">
              <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rajlo-black text-[11px] font-extrabold text-white">
                {String.fromCharCode(65 + s.position)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                  Stop {s.position}
                </p>
                <p className="mt-0.5 truncate text-sm font-bold">{s.name}</p>
                <p className="truncate text-xs text-muted">{s.address}</p>
              </div>
            </div>
          ))}

          <div className="mt-4 flex items-start gap-3">
            <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rajlo-red text-[11px] font-extrabold text-white">
              {String.fromCharCode(66 + ride.stops.length)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                Dropoff
              </p>
              <p className="mt-0.5 truncate text-sm font-bold">
                {ride.dropoff.name}
              </p>
              <p className="truncate text-xs text-muted">
                {ride.dropoff.address}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
            <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
              Estimated fare
            </p>
            <p className="text-lg font-extrabold tracking-tight text-rajlo-red">
              {formatJMD(ride.estimatedFareJMD)}
            </p>
          </div>
        </div>
      </FadeUp>

      {/* Action row — safety + cancel side-by-side while the trip is live. */}
      {!isTerminal && (
        <FadeUp delay={0.2}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setSafetyOpen(true)}
              className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rajlo-red px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
            >
              <Icon name="shield" className="h-4 w-4" />
              Safety toolkit
            </button>
            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-4 py-3 text-xs font-bold text-muted transition-colors hover:bg-surface-soft hover:text-rajlo-red disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-5 sm:text-sm"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
                {cancelling ? "Cancelling…" : "Cancel ride"}
              </button>
            )}
          </div>
        </FadeUp>
      )}

      {isTerminal && (
        <FadeUp delay={0.2}>
          <Link
            href="/rider/request"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Book another ride
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </FadeUp>
      )}

      {safetyOpen && (
        <SafetySheet
          rideId={ride.id}
          livePosition={
            riderPosition
              ? { lat: riderPosition.lat, lng: riderPosition.lng }
              : null
          }
          onClose={() => setSafetyOpen(false)}
        />
      )}
    </div>
  );
}
