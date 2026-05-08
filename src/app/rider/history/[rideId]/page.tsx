"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { MapView } from "@/components/map-view";
import { RateDialog } from "@/components/rate-dialog";
import { DriverVehicleCard } from "@/components/driver-vehicle-card";
import {
  DriverVehicleCardSkeleton,
  HeroSkeleton,
  MapSkeleton,
  Skeleton,
} from "@/components/skeleton";
import { formatJMD, type Place } from "@/lib/jamaica";

/**
 * Full ride detail — the receipt + receipt-with-map view a rider hits
 * when they tap a row on /rider/history.
 *
 * Pulls the canonical ride from /api/rider/rides/[id], renders:
 *   - Hero status banner (colour-coded by lifecycle stage)
 *   - Map of the route (pickup → stops → dropoff, road-following)
 *   - Status timeline showing each stamped event
 *   - Driver card with average rating + plate
 *   - Fare summary
 *   - Rate-now CTA for unrated completed trips
 *   - Re-book CTA (kicks off a new request with the same endpoints)
 */

type RideStatus =
  | "requested"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type RideDetail = {
  id: string;
  status: RideStatus;
  pickup: { name: string; address: string; lat: number; lng: number };
  dropoff: { name: string; address: string; lat: number; lng: number };
  stops: {
    position: number;
    name: string;
    address: string;
    lat: number;
    lng: number;
  }[];
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
    completedAt: string | null;
    cancelledAt: string | null;
  };
  cancellationReason: string | null;
};

type DriverInfo = {
  name: string;
  phone: string | null;
  plateNumber: string | null;
  vehicle: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleColor: string | null;
  rating: number | null;
  ratingCount: number;
  avatarUrl: string | null;
};

type DetailResponse = {
  ride: RideDetail;
  driver: DriverInfo | null;
};

const STATUS_HERO: Record<
  RideStatus,
  { eyebrow: string; tone: "emerald" | "amber" | "red" | "black" }
> = {
  requested: { eyebrow: "Looking for a driver", tone: "red" },
  accepted: { eyebrow: "Driver on the way", tone: "amber" },
  arrived: { eyebrow: "Driver at pickup", tone: "emerald" },
  in_progress: { eyebrow: "Trip in progress", tone: "emerald" },
  completed: { eyebrow: "Trip complete", tone: "emerald" },
  cancelled: { eyebrow: "Trip cancelled", tone: "black" },
};

export default function RiderHistoryDetailPage({
  params,
}: {
  params: Promise<{ rideId: string }>;
}) {
  const { rideId } = use(params);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/rider/rides/${rideId}`);
        if (!res.ok) throw new Error(`Couldn't load this ride.`);
        const json = (await res.json()) as DetailResponse;
        if (cancelled) return;
        setData(json);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Couldn't load this ride.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  if (loading) {
    // Skeleton mirrors the real layout below: breadcrumb pill + hero
    // + map + timeline + driver card. Same vertical rhythm as the
    // loaded version so the page doesn't jump when data lands.
    return (
      <div className="mx-auto max-w-3xl space-y-5 py-2 md:px-3 md:py-8">
        <Skeleton className="h-5 w-40" rounded="full" />
        <HeroSkeleton />
        <MapSkeleton className="h-[42vh] min-h-72 w-full md:h-[50vh] md:max-h-130" />
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-2.5 w-20" rounded="md" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8" rounded="full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-44" rounded="md" />
                <Skeleton className="h-2.5 w-32" rounded="md" />
              </div>
            </div>
          ))}
        </div>
        <DriverVehicleCardSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft">
          <span aria-hidden className="text-3xl leading-none">😢</span>
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
          Trip not found
        </h1>
        <p className="mt-2 text-sm text-muted">
          {error ?? "This trip may have been deleted, or it's not yours."}
        </p>
        <Link
          href="/rider/history"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white hover:bg-primary-hover"
        >
          Back to history
          <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const { ride, driver } = data;
  const hero = STATUS_HERO[ride.status];

  // Map waypoints in canonical Place shape.
  const placeFrom = (p: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  }): Place => ({
    placeId: "",
    name: p.name,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    parish: null,
  });
  const mapPickup = placeFrom(ride.pickup);
  const mapDropoff = placeFrom(ride.dropoff);
  const mapStops = ride.stops.map(placeFrom);

  // Build the chronological timeline. We only render entries that
  // have a timestamp — this is a real audit trail, not a "fake all
  // five steps" UI element.
  const timelineEntries = [
    {
      key: "requestedAt",
      label: "Trip requested",
      at: ride.timeline.requestedAt,
      icon: "plus-circle" as const,
    },
    {
      key: "acceptedAt",
      label: "Driver accepted",
      at: ride.timeline.acceptedAt,
      icon: "check-circle" as const,
    },
    {
      key: "arrivedAt",
      label: "Driver arrived at pickup",
      at: ride.timeline.arrivedAt,
      icon: "map-pin" as const,
    },
    {
      key: "startedAt",
      label: "Trip started",
      at: ride.timeline.startedAt,
      icon: "navigation" as const,
    },
    {
      key: "endedAt",
      label: ride.status === "cancelled" ? "Trip cancelled" : "Trip completed",
      at: ride.timeline.completedAt ?? ride.timeline.cancelledAt,
      icon:
        ride.status === "cancelled"
          ? ("x" as const)
          : ("check-circle" as const),
    },
  ].filter((e) => !!e.at);

  // Trip duration if completed.
  const startedTs = ride.timeline.startedAt
    ? new Date(ride.timeline.startedAt).getTime()
    : null;
  const completedTs = ride.timeline.completedAt
    ? new Date(ride.timeline.completedAt).getTime()
    : null;
  const tripMinutes =
    startedTs && completedTs
      ? Math.max(1, Math.round((completedTs - startedTs) / 60_000))
      : null;

  const isTerminal = ride.status === "completed" || ride.status === "cancelled";
  const canRate = ride.status === "completed" && !!driver && myRating === null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-2 py-6 md:px-3 md:py-8">
      <FadeUp>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <Link
            href="/rider/history"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-surface-soft"
          >
            <Icon name="chevron-left" className="h-3.5 w-3.5" />
            All trips
          </Link>
          <span>·</span>
          <span className="font-mono text-[11px] uppercase">
            #{ride.id.slice(0, 8)}
          </span>
        </div>
      </FadeUp>

      {/* Hero */}
      <FadeUp delay={0.05}>
        <div
          className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl md:p-8 ${
            hero.tone === "emerald"
              ? "bg-emerald-600 shadow-emerald-600/30"
              : hero.tone === "amber"
                ? "bg-rajlo-black shadow-rajlo-black/30"
                : hero.tone === "red"
                  ? "bg-rajlo-red shadow-rajlo-red/30"
                  : "bg-rajlo-black shadow-rajlo-black/30"
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
              {ride.pickup.name} → {ride.dropoff.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
              <p className="text-3xl font-extrabold tracking-tight">
                {formatJMD(ride.estimatedFareJMD)}
              </p>
              {tripMinutes !== null && (
                <p className="text-sm text-white/80">{tripMinutes} min trip</p>
              )}
              {ride.estimatedDistanceKm !== null && (
                <p className="text-sm text-white/80">
                  {ride.estimatedDistanceKm.toFixed(1)} km
                </p>
              )}
            </div>
          </div>
        </div>
      </FadeUp>

      {/* Map */}
      <FadeUp delay={0.1}>
        <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-lg shadow-rajlo-red/4">
          <MapView
            pickup={mapPickup}
            stops={mapStops}
            dropoff={mapDropoff}
            className="h-[42vh] min-h-72 w-full md:h-[50vh] md:max-h-130"
          />
        </div>
      </FadeUp>

      {/* Timeline */}
      <FadeUp delay={0.15}>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
            Timeline
          </p>
          {/* No `space-y` between rows — that would punch a gap into
             the connector. Instead each row keeps its own bottom
             padding (skipped on the last item) and the connector
             stretches via `flex-1` to fill the entire column from the
             current icon's bottom edge down to the next icon's top
             edge, so the line visibly joins the two circles. */}
          <ol className="mt-4">
            {timelineEntries.map((e, i) => {
              const isLast = i === timelineEntries.length - 1;
              return (
                <li key={e.key} className="flex gap-3">
                  <div className="flex flex-col items-center self-stretch">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-rajlo-red">
                      <Icon name={e.icon} className="h-4 w-4" />
                    </span>
                    {!isLast && (
                      <span className="w-px flex-1 bg-line" />
                    )}
                  </div>
                  <div
                    className={`min-w-0 flex-1 ${isLast ? "" : "pb-6"}`}
                  >
                    <p className="text-sm font-bold">{e.label}</p>
                    <p className="text-xs text-muted">
                      {e.at
                        ? new Date(e.at).toLocaleString("en-JM", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {ride.cancellationReason && (
            <div className="mt-4 rounded-xl bg-surface-soft px-4 py-3">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                Cancellation reason
              </p>
              <p className="mt-1 text-sm text-foreground">
                {ride.cancellationReason}
              </p>
            </div>
          )}
        </div>
      </FadeUp>

      {/* Driver + vehicle card */}
      {driver && (
        <FadeUp delay={0.2}>
          <DriverVehicleCard
            name={driver.name}
            avatarUrl={driver.avatarUrl}
            rating={driver.rating}
            ratingCount={driver.ratingCount}
            phone={driver.phone}
            plateNumber={driver.plateNumber}
            vehicleMake={driver.vehicleMake}
            vehicleModel={driver.vehicleModel}
            vehicleYear={driver.vehicleYear}
            vehicleColor={driver.vehicleColor}
          />
        </FadeUp>
      )}

      {/* Stops summary */}
      <FadeUp delay={0.22}>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
            Route
          </p>
          <div className="mt-4 space-y-3">
            <RouteRow
              label="A"
              tone="bg-emerald-500"
              eyebrow="Pickup"
              name={ride.pickup.name}
              address={ride.pickup.address}
            />
            {ride.stops.map((s) => (
              <RouteRow
                key={s.position}
                label={String.fromCharCode(65 + s.position)}
                tone="bg-rajlo-black"
                eyebrow={`Stop ${s.position}`}
                name={s.name}
                address={s.address}
              />
            ))}
            <RouteRow
              label={String.fromCharCode(66 + ride.stops.length)}
              tone="bg-rajlo-red"
              eyebrow="Dropoff"
              name={ride.dropoff.name}
              address={ride.dropoff.address}
            />
          </div>
          {ride.notes && (
            <div className="mt-5 rounded-xl bg-primary-soft px-4 py-3">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                Note from you
              </p>
              <p className="mt-1 text-sm text-rajlo-black">{ride.notes}</p>
            </div>
          )}
        </div>
      </FadeUp>

      {/* Fare receipt */}
      <FadeUp delay={0.25}>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line bg-surface-soft px-5 py-4">
            <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
              {ride.status === "cancelled" ? "Estimated fare" : "Trip total"}
            </p>
            <p
              className={`text-2xl font-extrabold tracking-tight ${
                ride.status === "cancelled"
                  ? "text-muted line-through"
                  : "text-rajlo-red"
              }`}
            >
              {formatJMD(ride.estimatedFareJMD)}
            </p>
          </div>
          <ul className="space-y-1.5 px-5 py-4 text-xs">
            <ReceiptRow label="Seats" value={`${ride.seats}`} />
            {ride.estimatedDistanceKm !== null && (
              <ReceiptRow
                label="Distance"
                value={`${ride.estimatedDistanceKm.toFixed(1)} km`}
              />
            )}
            {ride.estimatedEtaMinutes !== null && (
              <ReceiptRow
                label="Estimated time"
                value={`${ride.estimatedEtaMinutes} min`}
              />
            )}
            {tripMinutes !== null && (
              <ReceiptRow label="Actual time" value={`${tripMinutes} min`} />
            )}
            {ride.stops.length > 0 && (
              <ReceiptRow
                label="Intermediate stops"
                value={`${ride.stops.length}`}
              />
            )}
          </ul>
        </div>
      </FadeUp>

      {/* Actions */}
      <FadeUp delay={0.3}>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canRate && (
            <button
              type="button"
              onClick={() => setRateOpen(true)}
              className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
            >
              <Icon name="star" className="h-4 w-4" />
              Rate the driver
            </button>
          )}
          {myRating !== null && (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-700">
              <Icon name="check-circle" className="h-4 w-4" />
              You rated · {myRating}
            </div>
          )}
          {isTerminal && (
            <Link
              href="/rider/request"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-sm font-bold text-foreground transition-all hover:bg-surface-soft"
            >
              Book again
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          )}
        </div>
      </FadeUp>

      {rateOpen && (
        <RateDialog
          endpoint={`/api/rider/rides/${ride.id}/rate`}
          title={`Rate ${driver?.name ?? "your driver"}`}
          subtitle="Your feedback helps other riders pick the right driver."
          onClose={() => setRateOpen(false)}
          onSubmitted={(stars) => setMyRating(stars)}
        />
      )}
    </div>
  );
}

/* ─────────── Helpers ─────────── */

function RouteRow({
  label,
  tone,
  eyebrow,
  name,
  address,
}: {
  label: string;
  tone: string;
  eyebrow: string;
  name: string;
  address: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white ${tone}`}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
          {eyebrow}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold">{name}</p>
        <p className="truncate text-xs text-muted">{address}</p>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </li>
  );
}
