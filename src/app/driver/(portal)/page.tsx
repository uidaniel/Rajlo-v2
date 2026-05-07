"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RideRequestCard } from "@/components/ride-request-card";
import { complianceThresholds } from "@/lib/mock-data";
import { buildMockCompliancePayload } from "@/lib/compliance-utils";
import { Icon, type IconName } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp, Stagger, StaggerItem } from "@/components/anim";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { formatJMD } from "@/lib/jamaica";
import { useFleetBroadcaster } from "@/lib/use-fleet";

type RidePlace = { name: string; address: string; parish: string | null };

type InboxSolo = {
  kind: "solo";
  id: string;
  pickup: RidePlace;
  dropoff: RidePlace;
  stopsCount: number;
  seats: number;
  notes: string | null;
  estimatedFareJMD: number;
  estimatedDistanceKm: number | null;
  estimatedEtaMinutes: number | null;
  requestedAt: string;
};

type InboxCarpool = {
  kind: "carpool";
  id: string; // primary's id — used for the accept call
  groupId: string;
  rideIds: string[];
  primary: { rideId: string; pickup: RidePlace; dropoff: RidePlace; seats: number; fareJMD: number };
  secondary: { rideId: string; pickup: RidePlace; dropoff: RidePlace; seats: number; fareJMD: number };
  totalSeats: number;
  combinedFareJMD: number;
  requestedAt: string;
};

type InboxEntry = InboxSolo | InboxCarpool;

export default function DriverHomePage() {
  const router = useRouter();
  const [complianceSummary, setComplianceSummary] = React.useState(
    () => buildMockCompliancePayload("DRV-1031").summary,
  );
  const [online, setOnline] = React.useState(true);
  const [inboxRides, setInboxRides] = React.useState<InboxEntry[]>([]);
  const [acceptError, setAcceptError] = React.useState<string | null>(null);
  const [accepting, setAccepting] = React.useState<string | null>(null);
  // Auth user id — needed so our fleet broadcasts include a stable driver
  // identifier, which lets the rider booking screen dedupe the multiple
  // pings from one driver into a single moving car marker.
  const [driverUserId, setDriverUserId] = React.useState<string | null>(null);
  // Whether the driver has an in-flight trip (status accepted/arrived/
  // in_progress). When true, we hide the inbox and show a CTA back to
  // the active-trip console — the driver can't accept new rides while
  // already on one, so a "you have an active trip" banner is far more
  // useful than an empty inbox.
  const [hasActiveTrip, setHasActiveTrip] = React.useState(false);
  const [bootstrapping, setBootstrapping] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (mounted) setDriverUserId(user?.id ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // On mount and on every Realtime ride change, check if the driver
  // already has a trip in flight. If yes, surface the banner instead of
  // the inbox so the driver always knows where to find their trip.
  // Realtime alone isn't enough here: the driver might have refreshed
  // mid-trip with no inbox change pending, so we need the initial fetch.
  React.useEffect(() => {
    let cancelled = false;

    const checkActive = async () => {
      try {
        const res = await fetch("/api/driver/rides/active");
        if (!res.ok) return;
        const json = (await res.json()) as { ride: { id: string } | null };
        if (!cancelled) setHasActiveTrip(!!json.ride);
      } catch {
        /* network blip — Realtime will re-trigger this shortly */
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    };
    checkActive();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("driver-active-presence")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides" },
        () => {
          if (!cancelled) checkActive();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Fleet broadcaster: while online, push our GPS to the global
  // `fleet:online` channel every ~5s. Riders on the booking screen
  // subscribe and render a car icon for each unique driverId. The
  // hook itself is a no-op when either argument is falsy, so there's
  // no GPS access until the driver explicitly toggles online.
  // Also gated off while on an active trip — at that point GPS is
  // already flowing through the per-ride position channel, no need to
  // double-broadcast.
  const { error: fleetError } = useFleetBroadcaster(
    driverUserId,
    online && !hasActiveTrip,
  );

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/api/driver/compliance?driverId=DRV-1031");
        if (!response.ok) return;
        const payload = (await response.json()) as {
          summary: { expired: number; urgent: number; upcoming: number };
        };
        if (mounted && payload.summary) setComplianceSummary(payload.summary);
      } catch {
        /* silent — fall back to mock */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Inbox: initial fetch + Supabase Realtime subscription on `rides`. RLS
  // restricts what the driver receives to (a) rides assigned to them and
  // (b) the open `requested` pool — so any INSERT into the open pool, or
  // any UPDATE that flips a ride's status (someone else accepts → it
  // leaves the pool), pushes us a refresh. No polling.
  //
  // Skipped while the driver has an active trip — they can't take a new
  // ride from the inbox until they finish the current one, so there's
  // no point keeping the websocket open or fetching the list.
  React.useEffect(() => {
    if (!online || hasActiveTrip) {
      setInboxRides([]);
      return;
    }
    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await fetch("/api/driver/inbox");
        if (res.ok && !cancelled) {
          const json = (await res.json()) as { rides: InboxEntry[] };
          setInboxRides(json.rides ?? []);
        }
      } catch {
        /* network blip — Realtime will trigger another refresh later */
      }
    };
    refresh();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("driver-inbox")
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
  }, [online, hasActiveTrip]);

  const handleAccept = async (rideId: string) => {
    setAccepting(rideId);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/driver/rides/${rideId}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Server returned ${res.status}`);
      }
      // Send the driver straight to the active-trip console — that's
      // the only view they can usefully act on while the trip is in
      // flight, and going there directly is snappier than rendering an
      // intermediate "ride accepted!" card. The active-trip page
      // hydrates from /api/driver/rides/active, so it's also
      // refresh-survivable.
      router.push("/driver/active-trip");
    } catch (err) {
      setAcceptError(
        err instanceof Error ? err.message : "Couldn't accept ride.",
      );
      setAccepting(null);
    }
  };

  const handleDecline = (rideId: string) => {
    // Phase 2A.1 doesn't persist declines — just hide locally so the
    // driver can keep scanning the inbox. A "declined" event log + per-driver
    // decline filtering will land in 2A.2.
    setInboxRides((prev) => prev.filter((r) => r.id !== rideId));
  };

  const incomingCount = inboxRides.length;

  /* While the active-trip check is in flight, hold off rendering — we
     don't want to flash the empty inbox/dashboard if the driver is
     about to be sent to the active-trip CTA. */
  if (bootstrapping) {
    return (
      <div className="grid place-items-center px-4 py-16">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-rajlo-red border-t-transparent" />
          Loading dashboard…
        </div>
      </div>
    );
  }

  /* ───────────── Active-trip CTA ─────────────
     If the driver landed back on the dashboard while a trip is in
     flight (refresh, deep-link, swipe-back, etc.), they can't usefully
     act on this page — the inbox is hidden, status changes happen on
     /driver/active-trip. Render a single big CTA pointing them there.
     This is the refresh-survivable replacement for the old "Ride
     accepted!" inline view. */
  if (hasActiveTrip) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 md:px-6 md:py-12">
        <FadeUp>
          <div className="relative overflow-hidden rounded-3xl bg-rajlo-red p-7 text-white shadow-xl shadow-rajlo-red/25 md:p-10">
            <ArcWatermark
              size={320}
              variant="white"
              className="absolute -right-14 -bottom-14 opacity-[0.12]"
            />
            <div className="relative">
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-white/85">
                You&apos;re on a trip
              </p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                Active ride in progress
              </h1>
              <p className="mt-2 max-w-md text-sm text-white/85 md:text-base">
                Open the active-trip console to see the live route, the
                rider&apos;s details, and the next-action button.
              </p>
              <Link
                href="/driver/active-trip"
                className="group mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-rajlo-red shadow-lg transition-all hover:-translate-y-0.5"
              >
                Open active trip
                <Icon
                  name="arrow-right"
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
          </div>
        </FadeUp>
      </div>
    );
  }

  /* ───────────── Default view ───────────── */
  const complianceTone =
    complianceSummary.expired > 0
      ? "danger"
      : complianceSummary.urgent > 0
        ? "warn"
        : complianceSummary.upcoming > 0
          ? "info"
          : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-6 md:py-8">
      {/* ─────── Welcome / status hero ─────── */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-6 text-white shadow-xl md:p-8">
          <ArcWatermark size={420} variant="red" className="absolute -right-20 -bottom-32 opacity-[0.12]" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Driver dashboard
              </p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                {online ? "You're online & ready." : "You're offline."}
              </h1>
              <p className="mt-1 text-sm text-white/70 md:text-base">
                {online
                  ? "Incoming ride requests will appear below."
                  : "Toggle online to start receiving requests."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOnline((o) => !o)}
              aria-pressed={online}
              aria-label={online ? "Go offline" : "Go online"}
              className={`relative inline-flex h-11 w-20 items-center rounded-full transition-colors ${
                online ? "bg-emerald-500" : "bg-white/15"
              }`}
            >
              <span
                className={`inline-flex h-9 w-9 transform items-center justify-center rounded-full bg-white shadow-lg transition-all ${
                  online ? "translate-x-10" : "translate-x-1"
                }`}
              >
                <Icon
                  name={online ? "check-circle" : "x"}
                  className={`h-4 w-4 ${online ? "text-emerald-600" : "text-muted"}`}
                />
              </span>
            </button>
          </div>
        </div>
      </FadeUp>

      {/* ─────── Fleet broadcast error ───────
         If the driver toggled online but the browser denied location
         access (or some other GPS error), surface it here so they
         know why riders aren't seeing their car. The error comes from
         the fleet broadcaster hook — it captures geolocation failures
         silently otherwise, which is bad UX. */}
      {online && fleetError && (
        <FadeUp delay={0.03}>
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white">
              <Icon name="alert-triangle" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug text-amber-900">
                Riders can&apos;t see your car on the map yet
              </p>
              <p className="mt-0.5 text-xs text-amber-800">{fleetError}</p>
            </div>
          </div>
        </FadeUp>
      )}

      {/* ─────── Compliance banner ─────── */}
      {complianceTone && (
        <FadeUp delay={0.05}>
          <div
            className={`flex flex-col gap-3 rounded-2xl border p-5 md:flex-row md:items-center md:justify-between ${
              complianceTone === "danger"
                ? "border-rajlo-red/30 bg-primary-soft"
                : complianceTone === "warn"
                  ? "border-amber-200 bg-amber-50"
                  : "border-rajlo-red/20 bg-primary-soft/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  complianceTone === "danger"
                    ? "bg-rajlo-red text-white"
                    : complianceTone === "warn"
                      ? "bg-amber-500 text-white"
                      : "bg-rajlo-red/15 text-rajlo-red"
                }`}
              >
                <Icon
                  name={complianceTone === "danger" ? "alert-triangle" : "shield-alert"}
                  className="h-5 w-5"
                />
              </span>
              <div>
                <p className="text-sm font-bold leading-snug">
                  {complianceSummary.expired > 0
                    ? `${complianceSummary.expired} TA document${complianceSummary.expired > 1 ? "s" : ""} expired or missing.`
                    : complianceSummary.urgent > 0
                      ? `${complianceSummary.urgent} TA document${complianceSummary.urgent > 1 ? "s" : ""} expire within ${complianceThresholds.urgentDays} days.`
                      : `${complianceSummary.upcoming} TA document${complianceSummary.upcoming > 1 ? "s" : ""} due within ${complianceThresholds.warningDays} days.`}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Keep TA documents current to continue accepting ride requests.
                </p>
              </div>
            </div>
            <Link
              href="/driver/verification"
              className="shrink-0 self-start rounded-full bg-rajlo-red px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover md:self-center"
            >
              View compliance →
            </Link>
          </div>
        </FadeUp>
      )}

      {/* ─────── Stats ─────── */}
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Requests" value={incomingCount.toString()} icon="inbox" />
        <Stat label="Today" value="JMD 5.2k" icon="trending-up" />
        <Stat label="Rating" value="4.8" icon="star" />
        <Stat label="Trips" value="142" icon="navigation" />
      </Stagger>

      {/* ─────── Incoming requests ─────── */}
      {online && (
        <FadeUp delay={0.1}>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight md:text-xl">
                Incoming requests
              </h2>
              {incomingCount > 0 && (
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-rajlo-red">
                  {incomingCount} new
                </span>
              )}
            </div>

            {acceptError && (
              <div className="mb-3 rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
                {acceptError}
              </div>
            )}

            {incomingCount === 0 ? (
              <div className="rounded-2xl border border-line bg-surface p-8 text-center">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface-soft text-muted">
                  <Icon name="inbox" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-bold">No new requests yet</p>
                <p className="mt-1 text-xs text-muted">
                  Stay online — incoming rides will pop up here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {inboxRides.map((entry) => (
                  <div key={entry.id} className="relative">
                    {accepting === entry.id && (
                      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-sm">
                        <span className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-rajlo-red border-t-transparent" />
                      </div>
                    )}
                    {entry.kind === "solo" ? (
                      <RideRequestCard
                        ride={{
                          id: entry.id,
                          from: entry.pickup.name,
                          to: entry.dropoff.name,
                          eta: entry.estimatedEtaMinutes
                            ? `${entry.estimatedEtaMinutes} min`
                            : "—",
                          price: formatJMD(entry.estimatedFareJMD),
                          seats: entry.seats,
                          status: "searching" as const,
                        }}
                        onAccept={() => handleAccept(entry.id)}
                        onDecline={() => handleDecline(entry.id)}
                      />
                    ) : (
                      <CarpoolRequestCard
                        entry={entry}
                        onAccept={() => handleAccept(entry.id)}
                        onDecline={() => handleDecline(entry.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </FadeUp>
      )}

      {/* ─────── Quick actions ─────── */}
      <FadeUp delay={0.15}>
        <div>
          <h2 className="mb-3 text-lg font-extrabold tracking-tight md:text-xl">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ActionCard label="Earnings" href="/driver/earnings" icon="trending-up" />
            <ActionCard label="History" href="/driver/history" icon="clock" />
            <ActionCard label="Compliance" href="/driver/verification" icon="shield-check" />
            <ActionCard label="Notifications" href="/driver/notifications" icon="bell" />
          </div>
        </div>
      </FadeUp>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <StaggerItem>
      <div className="rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-rajlo-red">
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="mt-2 text-2xl font-extrabold tracking-tight text-rajlo-red md:text-3xl">
          {value}
        </p>
      </div>
    </StaggerItem>
  );
}

function ActionCard({
  label,
  href,
  icon,
}: {
  label: string;
  href: string;
  icon: IconName;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-rajlo-red hover:shadow-md"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-rajlo-red transition-colors group-hover:bg-rajlo-red group-hover:text-white">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm font-bold">{label}</p>
    </Link>
  );
}

/**
 * Inbox card for a carpool group — two riders going the same way that
 * the matcher paired together. Visually distinct from solo cards (a
 * "Carpool" badge + a 2-passenger pickup ladder) so the driver knows
 * up-front they're committing to two pickups + two dropoffs in one go.
 * Accepting this card claims BOTH rides atomically server-side.
 */
function CarpoolRequestCard({
  entry,
  onAccept,
  onDecline,
}: {
  entry: InboxCarpool;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-rajlo-red/30 bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 bg-primary-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-rajlo-red text-white">
            <Icon name="users" className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-rajlo-red">
            Carpool · 2 riders
          </span>
        </div>
        <span className="text-xs font-bold text-rajlo-red">
          {formatJMD(entry.combinedFareJMD)}
        </span>
      </div>

      <div className="space-y-4 p-4 md:p-6">
        <div>
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
            Rider 1 · Pickup first
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">
            {entry.primary.pickup.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            → {entry.primary.dropoff.name}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {entry.primary.seats} seat{entry.primary.seats === 1 ? "" : "s"} ·{" "}
            {formatJMD(entry.primary.fareJMD)}
          </p>
        </div>
        <div className="border-t border-line pt-4">
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
            Rider 2 · Pickup second
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">
            {entry.secondary.pickup.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            → {entry.secondary.dropoff.name}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {entry.secondary.seats} seat{entry.secondary.seats === 1 ? "" : "s"} ·{" "}
            {formatJMD(entry.secondary.fareJMD)}
          </p>
        </div>

        <div className="flex gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-lg border border-line py-2.5 text-sm font-bold transition-colors hover:bg-surface-soft"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-lg bg-rajlo-red py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Accept carpool
          </button>
        </div>
      </div>
    </div>
  );
}
