"use client";

import { use, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icons";
import { MapView } from "@/components/map-view";
import { useRidePosition } from "@/lib/use-ride-position";
import { type Place } from "@/lib/jamaica";

/**
 * Public trip-share page.
 *
 * Anyone with the URL can open this — the unguessable token in the path
 * is the only auth. We render a stripped-down view: pickup/dropoff,
 * status, driver name + plate, and the live driver/rider position.
 *
 * No login required, no PII beyond what the rider chose to share.
 */

type TripData = {
  rideId: string;
  status:
    | "requested"
    | "accepted"
    | "arrived"
    | "in_progress"
    | "completed"
    | "cancelled";
  pickup: { name: string; lat: number; lng: number };
  dropoff: { name: string; lat: number; lng: number };
  estimatedEtaMinutes: number | null;
  driver: { name: string; plateNumber: string | null } | null;
  recipientLabel: string | null;
};

const STATUS_LABELS: Record<TripData["status"], string> = {
  requested: "Looking for a driver",
  accepted: "Driver on the way",
  arrived: "Driver at pickup",
  in_progress: "On the way",
  completed: "Trip complete",
  cancelled: "Trip cancelled",
};

export default function TripSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<TripData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresh on a slow timer so the friend's view gets status changes even
  // before the realtime channel pushes (we can't subscribe to RLS-protected
  // tables anonymously). Live driver position still flows through the
  // broadcast channel below — that's not gated by RLS.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch(`/api/trip/${token}`);
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Server returned ${res.status}`);
        }
        const json = (await res.json()) as TripData;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Couldn't load trip.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    refresh();
    const interval = setInterval(refresh, 8_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  // Subscribe to the same broadcast channel the rider/driver use — anyone
  // with the channel name (= ride id) can subscribe. The rider already
  // knows we have it because they shared the link, so this is fine.
  const isLive =
    !!data &&
    ["accepted", "arrived", "in_progress"].includes(data.status);
  const { driverPosition, riderPosition } = useRidePosition(
    isLive ? data.rideId : null,
    "rider", // role doesn't matter when streamSelf is false; we only listen
    /* streamSelf */ false,
  );

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-soft">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-rajlo-red border-t-transparent" />
          Loading trip…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-soft px-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-rajlo-red">
            <Icon name="alert-triangle" className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
            Trip not available
          </h1>
          <p className="mt-2 text-sm text-muted">
            {error ?? "This share link may have expired or been revoked."}
          </p>
        </div>
      </div>
    );
  }

  const pickup: Place = {
    placeId: "",
    name: data.pickup.name,
    address: "",
    lat: data.pickup.lat,
    lng: data.pickup.lng,
    parish: null,
  };
  const dropoff: Place = {
    placeId: "",
    name: data.dropoff.name,
    address: "",
    lat: data.dropoff.lat,
    lng: data.dropoff.lng,
    parish: null,
  };

  const isTerminal = data.status === "completed" || data.status === "cancelled";

  return (
    <div className="min-h-screen bg-surface-soft pb-12">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Logo size="sm" tagline />
          <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-bold text-rajlo-red">
            Live trip share
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6 md:px-6">
        {/* Status hero */}
        <div
          className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl md:p-8 ${
            data.status === "in_progress" || data.status === "arrived"
              ? "bg-emerald-600 shadow-emerald-600/30"
              : data.status === "completed"
                ? "bg-emerald-700 shadow-emerald-700/30"
                : data.status === "cancelled"
                  ? "bg-rajlo-black shadow-rajlo-black/30"
                  : "bg-rajlo-red shadow-rajlo-red/30"
          }`}
        >
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-white/85">
            {data.recipientLabel
              ? `Trip share for ${data.recipientLabel}`
              : "Trip share"}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            {STATUS_LABELS[data.status]}
          </h1>
          {data.estimatedEtaMinutes !== null && !isTerminal && (
            <p className="mt-2 text-sm text-white/85">
              ETA ~{data.estimatedEtaMinutes} min
            </p>
          )}
        </div>

        {/* Map */}
        <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-lg shadow-rajlo-red/[0.04]">
          <MapView
            pickup={pickup}
            stops={[]}
            dropoff={dropoff}
            driverPosition={driverPosition}
            riderPosition={riderPosition}
            className="h-72 w-full md:h-96"
          />
        </div>

        {/* Driver card */}
        {data.driver && (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
              Driver
            </p>
            <p className="mt-1 text-base font-extrabold tracking-tight">
              {data.driver.name}
            </p>
            {data.driver.plateNumber && (
              <p className="mt-1 text-xs text-muted">
                Red plate · {data.driver.plateNumber}
              </p>
            )}
          </div>
        )}

        {/* Pickup → Dropoff */}
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
                {data.pickup.name}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3">
            <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rajlo-red text-[11px] font-extrabold text-white">
              B
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                Dropoff
              </p>
              <p className="mt-0.5 truncate text-sm font-bold">
                {data.dropoff.name}
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted">
          You&apos;re viewing a Rajlo trip share. The link stops working when
          the trip ends.
        </p>
      </div>
    </div>
  );
}
