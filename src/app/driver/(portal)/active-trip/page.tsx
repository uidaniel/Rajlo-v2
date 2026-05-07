"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { MapView } from "@/components/map-view";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRidePosition } from "@/lib/use-ride-position";
import { formatJMD, type Place } from "@/lib/jamaica";

/**
 * Driver's active-trip console.
 *
 * Shows the ride the signed-in driver is currently on (status accepted →
 * arrived → in_progress), with stage-specific copy and the next-action
 * button. Tapping the action calls /api/driver/rides/[id]/status to
 * transition the state-machine forward.
 *
 * Polls /api/driver/rides/active every 5s for now — Phase 2A.2 follow-up
 * swaps to Supabase Realtime so updates are instant.
 */

type ActiveRide = {
  id: string;
  status: "accepted" | "arrived" | "in_progress";
  pickup: { name: string; address: string; lat: number; lng: number };
  dropoff: { name: string; address: string; lat: number; lng: number };
  stops: { position: number; name: string; address: string; lat: number; lng: number }[];
  seats: number;
  notes: string | null;
  estimatedFareJMD: number;
  estimatedDistanceKm: number | null;
  estimatedEtaMinutes: number | null;
};

type CarpoolPartner = {
  rideId: string;
  riderName: string;
  pickup: { name: string; address: string; lat: number; lng: number };
  dropoff: { name: string; address: string; lat: number; lng: number };
  seats: number;
  fareJMD: number;
  status: string;
};

type ActiveResponse = {
  ride: ActiveRide | null;
  rider: { name: string; avatarUrl: string | null } | null;
  carpool: { groupId: string; partner: CarpoolPartner } | null;
};

const STAGE_COPY = {
  accepted: {
    eyebrow: "Heading to pickup",
    headline: "Drive to the pickup location",
    description: "Tap when you arrive so the rider knows you're outside.",
    actionLabel: "I've arrived at pickup",
    actionAction: "arrived" as const,
    nextStatus: "arrived" as const,
  },
  arrived: {
    eyebrow: "At pickup",
    headline: "Pick up your rider",
    description:
      "Confirm the rider is in the vehicle, then start the trip to begin metering.",
    actionLabel: "Start trip",
    actionAction: "start" as const,
    nextStatus: "in_progress" as const,
  },
  in_progress: {
    eyebrow: "On the way",
    headline: "Trip in progress",
    description: "Drive safely. Tap complete when the rider has been dropped off.",
    actionLabel: "Complete trip",
    actionAction: "complete" as const,
    nextStatus: "completed" as const,
  },
};

export default function DriverActiveTripPage() {
  const [data, setData] = useState<ActiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedFare, setCompletedFare] = useState<number | null>(null);

  // Live position channel: driver streams own GPS so the rider can watch
  // the car move on the map. Hook also receives the rider's position so
  // the driver sees a blue dot for the passenger as they approach pickup.
  const activeRideId = data?.ride?.id ?? null;
  const { driverPosition, riderPosition, geoError } = useRidePosition(
    activeRideId,
    "driver",
    /* streamSelf */ true,
  );

  const refresh = async () => {
    try {
      const res = await fetch("/api/driver/rides/active");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ActiveResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load active trip");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + Supabase Realtime subscription. RLS gates the driver
  // to their own rides + open requests, so we subscribe to all `rides`
  // changes and let the policy filter what reaches us.
  useEffect(() => {
    let cancelled = false;

    refresh();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("driver-active-trip")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides" },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAction = async (
    rideId: string,
    action: "arrived" | "start" | "complete",
    fareForCompletion: number,
  ) => {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/driver/rides/${rideId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Server returned ${res.status}`);
      }
      if (action === "complete") {
        setCompletedFare(fareForCompletion);
        setData({ ride: null, rider: null, carpool: null });
      } else {
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update status");
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async (rideId: string) => {
    if (!confirm("Cancel this ride? The rider will be notified.")) return;
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/driver/rides/${rideId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Server returned ${res.status}`);
      }
      setData({ ride: null, rider: null, carpool: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel ride");
    } finally {
      setActing(false);
    }
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="grid place-items-center px-4 py-16">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-rajlo-red border-t-transparent" />
          Loading your active trip…
        </div>
      </div>
    );
  }

  /* ─── Just-completed flash ─── */
  if (completedFare !== null) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <FadeUp>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-600 text-white shadow-2xl shadow-emerald-600/40">
            <Icon name="check-circle" className="h-10 w-10" />
          </div>
        </FadeUp>
        <FadeUp delay={0.1}>
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight">
            Trip complete
          </h1>
        </FadeUp>
        <FadeUp delay={0.2}>
          <p className="mt-3 text-sm text-muted">
            Great job. Your earnings for this trip:
          </p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-rajlo-red">
            {formatJMD(completedFare)}
          </p>
        </FadeUp>
        <FadeUp delay={0.3}>
          <Link
            href="/driver"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Back to dashboard
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </FadeUp>
      </div>
    );
  }

  /* ─── No active trip ─── */
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
          Head back to the dashboard and wait for an incoming request, or
          accept one from your inbox.
        </p>
        <Link
          href="/driver"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white hover:bg-primary-hover"
        >
          Back to dashboard
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const { ride, rider } = data;
  const stage = STAGE_COPY[ride.status];
  const initials = rider?.name
    ? rider.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("")
    : "?";

  // Always pass all the pins to MapView — the component itself hides
  // the pickup pin during in_progress (no longer relevant once the
  // rider is on board) and uses `liveRoute` to draw the polyline from
  // the driver's live position to the right target.
  //
  // For a carpool trip, we synthesise a multi-stop route through both
  // riders' points: primary pickup → partner pickup → primary dropoff
  // → partner dropoff. This gives the driver a clear visual of the
  // whole tour they've signed up for. (Live-route mode is disabled
  // for carpool — a single driver→target line doesn't capture the
  // multi-stage flow; the driver uses Google Maps for actual nav.)
  const carpool = data?.carpool ?? null;

  const mapPickup: Place = {
    placeId: "",
    name: ride.pickup.name,
    address: ride.pickup.address,
    lat: ride.pickup.lat,
    lng: ride.pickup.lng,
    parish: null,
  };
  const mapDropoff: Place = carpool
    ? {
        placeId: "",
        name: carpool.partner.dropoff.name,
        address: carpool.partner.dropoff.address,
        lat: carpool.partner.dropoff.lat,
        lng: carpool.partner.dropoff.lng,
        parish: null,
      }
    : {
        placeId: "",
        name: ride.dropoff.name,
        address: ride.dropoff.address,
        lat: ride.dropoff.lat,
        lng: ride.dropoff.lng,
        parish: null,
      };
  const mapStops: Place[] = carpool
    ? [
        // Partner's pickup goes between the two pickups.
        {
          placeId: "",
          name: carpool.partner.pickup.name,
          address: carpool.partner.pickup.address,
          lat: carpool.partner.pickup.lat,
          lng: carpool.partner.pickup.lng,
          parish: null,
        },
        // Then primary's dropoff. Partner's dropoff is the final dropoff
        // (set as `mapDropoff` above).
        {
          placeId: "",
          name: ride.dropoff.name,
          address: ride.dropoff.address,
          lat: ride.dropoff.lat,
          lng: ride.dropoff.lng,
          parish: null,
        },
      ]
    : ride.stops.map((s) => ({
        placeId: "",
        name: s.name,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        parish: null,
      }));

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6 md:py-8">
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-6 text-white shadow-xl shadow-rajlo-black/30 md:p-8">
          <ArcWatermark
            size={360}
            variant="red"
            className="absolute -right-20 -bottom-24 opacity-[0.18]"
          />
          <div className="relative">
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
              {stage.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
              {stage.headline}
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/75">
              {stage.description}
            </p>
          </div>
        </div>
      </FadeUp>

      {error && (
        <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
          {error}
        </div>
      )}
      {geoError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          {geoError} The rider can&apos;t track your position until this is
          fixed.
        </div>
      )}

      <FadeUp delay={0.05}>
        <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-lg shadow-rajlo-red/[0.04]">
          {/* The map is the driver's primary navigation surface — give
             it real viewport real-estate. Live-route mode draws the
             on-the-road line from the driver's current position to
             pickup (accepted/arrived) or dropoff (in_progress).
             Disabled for carpool: the route is a 4-point tour (two
             pickups + two dropoffs) rather than a single driver→target
             line, so we fall back to the static-route polyline. */}
          <MapView
            pickup={mapPickup}
            stops={mapStops}
            dropoff={mapDropoff}
            driverPosition={driverPosition}
            riderPosition={riderPosition}
            liveRoute={
              carpool
                ? null
                : ride.status === "in_progress"
                  ? { target: "dropoff" }
                  : { target: "pickup" }
            }
            className="h-[55vh] min-h-[20rem] w-full md:h-[60vh] md:max-h-[640px]"
          />
        </div>
      </FadeUp>

      {/* Carpool banner — distinct red ribbon making it crystal-clear
         the driver has two riders. Only shown when partner data is
         present in the response. */}
      {carpool && (
        <FadeUp delay={0.08}>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-rajlo-red/40 bg-primary-soft p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rajlo-red text-white">
              <Icon name="users" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                Carpool · 2 riders
              </p>
              <p className="mt-0.5 text-sm font-bold leading-snug">
                Pick up {rider?.name ?? "Rider 1"} first, then{" "}
                {carpool.partner.riderName}.
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Combined fare ·{" "}
                {formatJMD(
                  ride.estimatedFareJMD + carpool.partner.fareJMD,
                )}
              </p>
            </div>
          </div>
        </FadeUp>
      )}

      {rider && (
        <FadeUp delay={0.1}>
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft text-base font-extrabold text-rajlo-red ring-1 ring-rajlo-red/20">
              {rider.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rider.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                {carpool ? "Rider 1 (pickup first)" : "Rider"}
              </p>
              <p className="mt-0.5 truncate text-base font-extrabold tracking-tight">
                {rider.name}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {ride.seats} seat{ride.seats === 1 ? "" : "s"}
                {ride.estimatedFareJMD
                  ? ` · ${formatJMD(ride.estimatedFareJMD)} estimated`
                  : ""}
              </p>
            </div>
          </div>
        </FadeUp>
      )}

      {/* Carpool partner card — same shape as the primary rider card
         but visually demoted with "Rider 2 (pickup second)" so the
         driver knows the order. */}
      {carpool && (
        <FadeUp delay={0.12}>
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-rajlo-red/10 text-base font-extrabold text-rajlo-red ring-1 ring-rajlo-red/20">
              {carpool.partner.riderName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0]?.toUpperCase())
                .join("") || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                Rider 2 (pickup second)
              </p>
              <p className="mt-0.5 truncate text-base font-extrabold tracking-tight">
                {carpool.partner.riderName}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {carpool.partner.seats} seat
                {carpool.partner.seats === 1 ? "" : "s"} ·{" "}
                {formatJMD(carpool.partner.fareJMD)} estimated
              </p>
            </div>
          </div>
        </FadeUp>
      )}

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

          {ride.notes && (
            <div className="mt-5 rounded-xl bg-primary-soft px-4 py-3">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                Note from rider
              </p>
              <p className="mt-1 text-sm text-rajlo-black">{ride.notes}</p>
            </div>
          )}
        </div>
      </FadeUp>

      {/* ── Action bar ── */}
      <FadeUp delay={0.2}>
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-col gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:relative md:mx-0 md:rounded-2xl md:border md:bg-surface md:px-5 md:py-4">
          {/* Google Maps deep-link — stage-aware. Before pickup, route to
              pickup with the driver's live position as origin (Google
              Maps falls back to "current location" if origin omitted).
              After arrival, route pickup → stops → dropoff so the driver
              follows the ride's actual path. Opens in the Google Maps app
              on mobile, or the Maps web UI on desktop. */}
          <a
            href={buildGoogleMapsDirectionsUrl(ride)}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-bold text-foreground transition-all hover:-translate-y-0.5 hover:border-rajlo-red hover:bg-primary-soft hover:text-rajlo-red"
          >
            <Icon name="navigation" className="h-4 w-4 text-rajlo-red" />
            {ride.status === "accepted"
              ? "Open Google Maps · drive to pickup"
              : "Open Google Maps · drive to dropoff"}
            <Icon
              name="arrow-right"
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            />
          </a>

          <button
            type="button"
            onClick={() =>
              handleAction(ride.id, stage.actionAction, ride.estimatedFareJMD)
            }
            disabled={acting}
            className={`group inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:-translate-y-0 ${
              ride.status === "in_progress"
                ? "bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-700"
                : "bg-rajlo-red shadow-rajlo-red/30 hover:bg-primary-hover"
            }`}
          >
            {acting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-[2px] border-white border-t-transparent" />
                Working…
              </>
            ) : (
              <>
                {stage.actionLabel}
                <Icon
                  name={
                    ride.status === "in_progress" ? "check-circle" : "arrow-right"
                  }
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                />
              </>
            )}
          </button>
          {ride.status !== "in_progress" && (
            <button
              type="button"
              onClick={() => handleCancel(ride.id)}
              disabled={acting}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-muted transition-colors hover:bg-surface-soft hover:text-rajlo-red"
            >
              <Icon name="x" className="h-3 w-3" />
              Cancel ride
            </button>
          )}
        </div>
      </FadeUp>
    </div>
  );
}

/**
 * Build a `https://www.google.com/maps/dir/?...` URL the driver can hand
 * off to. Stage-dependent:
 *
 * - status=accepted   → origin = current location (omitted, Google asks),
 *                       destination = pickup
 * - status=arrived    → same as in_progress (driver is at pickup, about
 *                       to start driving the rider somewhere)
 * - status=in_progress → origin = pickup, destination = dropoff,
 *                        waypoints = each intermediate stop in order
 */
function buildGoogleMapsDirectionsUrl(ride: ActiveRide): string {
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("travelmode", "driving");

  if (ride.status === "accepted") {
    // Drive to pickup — use device's current location as origin (omit it
    // and Google Maps fills in "Your location").
    params.set("destination", `${ride.pickup.lat},${ride.pickup.lng}`);
    params.set("destination_place_id", ""); // ensures coords are honoured
  } else {
    // After arrival → route the actual ride: pickup → stops → dropoff.
    params.set("origin", `${ride.pickup.lat},${ride.pickup.lng}`);
    params.set("destination", `${ride.dropoff.lat},${ride.dropoff.lng}`);
    if (ride.stops.length > 0) {
      params.set(
        "waypoints",
        ride.stops.map((s) => `${s.lat},${s.lng}`).join("|"),
      );
    }
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
