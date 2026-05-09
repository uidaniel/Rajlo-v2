"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp, Stagger, StaggerItem } from "@/components/anim";
import { ListRowSkeleton, Skeleton } from "@/components/skeleton";
import { useBackgroundRefresh } from "@/lib/use-background-refresh";
import { formatJMD } from "@/lib/jamaica";

/**
 * Driver Route Taxi (Mode B) console.
 *
 * Single page that switches between two states:
 *   1. No active session → route picker (start a session pinned to a route)
 *   2. Active session   → live monitor with three buckets:
 *        - Pending hails on this route waiting to be accepted
 *        - Accepted hails (driver heading to pickup)
 *        - Onboard hails  (rider in the car, drop off + settle)
 *
 * Polls /sessions/current every 5s as a backup so the seat counter and
 * pending hails stay fresh even if realtime drops.
 */

type RouteRow = {
  id: string;
  origin: string;
  destination: string;
  parish: string | null;
  distanceKm: number;
  taFareJmd: number;
  slug: string;
};

type SessionPayload = {
  session: ActiveSession | null;
  pending: HailRow[];
  accepted: AcceptedHail[];
  onboard: OnboardHail[];
  driver: { activated: boolean; onboardingStatus: string } | null;
};

type ActiveSession = {
  id: string;
  routeId: string;
  direction: "forward" | "reverse";
  vehicleCapacity: number;
  seatsTaken: number;
  seatsRemaining: number;
  status: string;
  startedAt: string;
  route: {
    id: string;
    origin: string;
    destination: string;
    parish: string | null;
    distanceKm: number;
    taFareJmd: number;
  } | null;
};

type HailRow = {
  id: string;
  riderId: string;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  fareJmd: number;
  concession: boolean;
  requestedAt: string;
  /** Set by the server when both the driver and the rider have shared
   *  GPS — the hail row is sorted closest-first when present. */
  proximityKm?: number | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
};

type AcceptedHail = HailRow & { acceptedAt: string };
type OnboardHail = HailRow & { pickedUpAt: string };

export default function DriverRouteTaxiPage() {
  const [data, setData] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/driver/route-taxi/sessions/current");
      if (!res.ok) return;
      const json = (await res.json()) as SessionPayload;
      setData(json);
    } catch {
      /* network blip — next tick will catch up */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 5-second backup poll while a session is active. When there's no
  // session the picker is static — no need to hammer the API.
  useBackgroundRefresh(refresh, 5000, { enabled: Boolean(data?.session) });

  // Push the driver's GPS to the session every 15s while it's active.
  // Drives proximity-sorted hails on the matcher and "X km away" tags
  // on the rider's live status. Silent failures (denied permission,
  // browser without geolocation) just mean the driver loses the
  // proximity sort — every other hail action still works.
  useDriverPositionPush(Boolean(data?.session));

  const transition = useCallback(
    async (
      hailId: string,
      to: "accepted" | "picked_up" | "completed" | "cancelled",
    ) => {
      setActionPending(`${hailId}:${to}`);
      setActionError(null);
      try {
        const res = await fetch(`/api/driver/route-taxi/hails/${hailId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          message?: string;
        };
        if (!res.ok || !json.ok) {
          throw new Error(json.message ?? json.error ?? "Action failed");
        }
        await refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setActionPending(null);
      }
    },
    [refresh],
  );

  const endSession = useCallback(async () => {
    setActionPending("end");
    setActionError(null);
    try {
      const res = await fetch("/api/driver/route-taxi/sessions/end", {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? json.error ?? "Couldn't end session");
      }
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't end session");
    } finally {
      setActionPending(null);
    }
  }, [refresh]);

  if (loading) {
    return <RouteTaxiSkeleton />;
  }

  if (!data?.session) {
    return (
      <StartSessionPicker
        onStarted={() => {
          setActionError(null);
          void refresh();
        }}
        outerError={actionError}
        clearError={() => setActionError(null)}
      />
    );
  }

  return (
    <ActiveSessionMonitor
      session={data.session}
      pending={data.pending}
      accepted={data.accepted}
      onboard={data.onboard}
      onTransition={transition}
      onEnd={endSession}
      actionPending={actionPending}
      actionError={actionError}
      clearError={() => setActionError(null)}
    />
  );
}

/* ════════════════════ NO SESSION — START PICKER ════════════════════ */

function StartSessionPicker({
  onStarted,
  outerError,
  clearError,
}: {
  onStarted: () => void;
  outerError: string | null;
  clearError: () => void;
}) {
  const [routes, setRoutes] = useState<RouteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [parishFilter, setParishFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<RouteRow | null>(null);
  const [direction, setDirection] = useState<"forward" | "reverse">("forward");
  const [capacity, setCapacity] = useState(4);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rider/routes");
        if (!res.ok) throw new Error("Failed to load routes");
        const json = (await res.json()) as { routes: RouteRow[] };
        if (cancelled) return;
        setRoutes(json.routes);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Couldn't load routes");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const parishes = useMemo(() => {
    if (!routes) return [];
    const set = new Set<string>();
    for (const r of routes) if (r.parish) set.add(r.parish);
    return Array.from(set).sort();
  }, [routes]);

  const grouped = useMemo(() => {
    if (!routes) return [];
    const q = search.trim().toLowerCase();
    const filtered = routes.filter((r) => {
      if (parishFilter && r.parish !== parishFilter) return false;
      if (!q) return true;
      return (
        r.origin.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q)
      );
    });
    const groups = new Map<string, RouteRow[]>();
    for (const r of filtered) {
      const key = r.parish ?? "Other";
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([parish, rows]) => ({ parish, rows }));
  }, [routes, search, parishFilter]);

  const startSession = async () => {
    if (!selected) return;
    setStarting(true);
    clearError();
    try {
      const res = await fetch("/api/driver/route-taxi/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: selected.id,
          direction,
          vehicleCapacity: capacity,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Couldn't start session");
      }
      onStarted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start session");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <FadeUp>
        <section className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-xl shadow-rajlo-black/30 md:p-10">
          <ArcWatermark
            size={520}
            variant="white"
            className="absolute -right-24 -top-24 opacity-[0.06]"
          />
          <ArcWatermark
            size={360}
            variant="red"
            className="absolute -bottom-24 -left-20 opacity-[0.16]"
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Mode · Route Taxi
              </span>
              <span className="h-px flex-1 bg-white/15" />
            </div>
            <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
              Pick your corridor and go live
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/75 md:text-base">
              Riders hailing on this corridor get matched to your car. Wallet
              auto-debit on drop-off — every dollar accounted for, no cash to
              chase.
            </p>
          </div>
        </section>
      </FadeUp>

      {(outerError || error) && (
        <FadeUp delay={0.04}>
          <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
            {outerError ?? error}
          </div>
        </FadeUp>
      )}

      <FadeUp delay={0.05}>
        <section className="rounded-3xl border border-line bg-surface p-5 md:p-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-secondary text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
                Choose a route
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">
                {routes
                  ? `${routes.length.toLocaleString()} TA-licensed routes`
                  : "Loading…"}
              </h2>
            </div>
            {parishFilter && (
              <button
                type="button"
                onClick={() => setParishFilter(null)}
                className="text-xs font-bold text-rajlo-red hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <label className="relative block">
              <span className="sr-only">Search routes</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Half Way Tree, Papine, Spanish Town…"
                className="block w-full rounded-xl border border-line bg-surface-soft py-3 pl-10 pr-4 text-sm font-medium outline-none placeholder:text-muted focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/20"
              />
            </label>

            {parishes.length > 0 && (
              <div className="-mx-1 flex flex-wrap gap-1.5">
                {parishes.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setParishFilter((cur) => (cur === p ? null : p))
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                      parishFilter === p
                        ? "bg-rajlo-red text-white"
                        : "border border-line bg-surface text-muted hover:border-rajlo-red hover:text-rajlo-red"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5">
            {!routes && !error && (
              <div className="space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <ListRowSkeleton key={i} />
                ))}
              </div>
            )}
            {routes && grouped.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line bg-surface-soft p-8 text-center">
                <p className="text-sm font-bold">No matching routes</p>
              </div>
            )}
            {routes && grouped.length > 0 && (
              <Stagger className="space-y-6" amount={0.04}>
                {grouped.map((g) => (
                  <StaggerItem key={g.parish}>
                    <div>
                      <p className="font-secondary mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                        {g.parish} · {g.rows.length}
                      </p>
                      <ul className="space-y-1.5">
                        {g.rows.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => setSelected(r)}
                              className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                                selected?.id === r.id
                                  ? "border-rajlo-red bg-primary-soft"
                                  : "border-line bg-surface hover:border-rajlo-red hover:shadow-md"
                              }`}
                            >
                              <span
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                                  selected?.id === r.id
                                    ? "bg-rajlo-red text-white"
                                    : "bg-surface-soft text-muted"
                                }`}
                              >
                                <Icon name="navigation" className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold">
                                  {r.origin}{" "}
                                  <span className="text-rajlo-red">→</span>{" "}
                                  {r.destination}
                                </p>
                                <p className="text-[11px] text-muted">
                                  {r.distanceKm.toFixed(1)} km · TA{" "}
                                  {formatJMD(r.taFareJmd)}/leg
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </div>
        </section>
      </FadeUp>

      {selected && (
        <FadeUp delay={0.05}>
          <section className="sticky bottom-4 z-20 rounded-3xl border border-line bg-surface p-5 shadow-2xl shadow-rajlo-red/10 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-5">
              <div className="min-w-0 flex-1">
                <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                  Selected
                </p>
                <p className="mt-0.5 truncate text-sm font-extrabold tracking-tight md:text-base">
                  {selected.origin} <span className="text-rajlo-red">→</span>{" "}
                  {selected.destination}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {selected.distanceKm.toFixed(1)} km ·{" "}
                  {formatJMD(selected.taFareJmd)}/leg
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
                <DirectionToggle value={direction} onChange={setDirection} />
                <CapacityStepper value={capacity} onChange={setCapacity} />
              </div>

              <button
                type="button"
                onClick={startSession}
                disabled={starting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-white border-t-transparent" />
                    Going live…
                  </>
                ) : (
                  <>
                    Go live on this route
                    <Icon name="arrow-right" className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </section>
        </FadeUp>
      )}
    </div>
  );
}

function DirectionToggle({
  value,
  onChange,
}: {
  value: "forward" | "reverse";
  onChange: (v: "forward" | "reverse") => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-line text-[11px] font-bold">
      <button
        type="button"
        onClick={() => onChange("forward")}
        className={`px-3 py-2 ${
          value === "forward"
            ? "bg-rajlo-black text-white"
            : "bg-surface text-muted hover:bg-surface-soft"
        }`}
      >
        Origin → Dest
      </button>
      <button
        type="button"
        onClick={() => onChange("reverse")}
        className={`px-3 py-2 ${
          value === "reverse"
            ? "bg-rajlo-black text-white"
            : "bg-surface text-muted hover:bg-surface-soft"
        }`}
      >
        Dest → Origin
      </button>
    </div>
  );
}

function CapacityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 text-xs font-bold">
      <span className="px-1 text-muted">Seats</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="grid h-6 w-6 place-items-center rounded-full bg-surface-soft text-muted hover:bg-rajlo-red hover:text-white"
      >
        −
      </button>
      <span className="w-5 text-center">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(16, value + 1))}
        className="grid h-6 w-6 place-items-center rounded-full bg-surface-soft text-muted hover:bg-rajlo-red hover:text-white"
      >
        +
      </button>
    </div>
  );
}

/* ════════════════════ ACTIVE SESSION — MONITOR ════════════════════ */

function ActiveSessionMonitor({
  session,
  pending,
  accepted,
  onboard,
  onTransition,
  onEnd,
  actionPending,
  actionError,
  clearError,
}: {
  session: ActiveSession;
  pending: HailRow[];
  accepted: AcceptedHail[];
  onboard: OnboardHail[];
  onTransition: (
    id: string,
    to: "accepted" | "picked_up" | "completed" | "cancelled",
  ) => void;
  onEnd: () => void;
  actionPending: string | null;
  actionError: string | null;
  clearError: () => void;
}) {
  const seatsFull = session.seatsRemaining <= 0;
  const isPending = (id: string, to: string) =>
    actionPending === `${id}:${to}`;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <FadeUp>
        <section className="relative overflow-hidden rounded-3xl bg-rajlo-black p-6 text-white shadow-xl shadow-rajlo-black/30 md:p-7">
          <ArcWatermark
            size={420}
            variant="red"
            className="absolute -right-24 -top-12 opacity-[0.18]"
          />
          <div className="relative grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-secondary text-xs font-bold uppercase tracking-wider text-emerald-200">
                  Live · accepting hails
                </span>
              </div>
              <h1 className="mt-2 truncate text-2xl font-extrabold tracking-tight md:text-3xl">
                {session.route?.origin}{" "}
                <span className="text-rajlo-red">→</span>{" "}
                {session.route?.destination}
              </h1>
              <p className="mt-1 text-xs text-white/70">
                {session.direction === "reverse" ? "Reverse leg" : "Forward leg"}{" "}
                · {session.route?.parish ?? ""} ·{" "}
                {session.route?.distanceKm.toFixed(1)} km
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 px-4 py-2.5 text-center">
                <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-white/65">
                  Seats
                </p>
                <p className="mt-0.5 text-2xl font-extrabold tracking-tight">
                  {session.seatsTaken}
                  <span className="text-white/55">/{session.vehicleCapacity}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onEnd}
                disabled={actionPending === "end"}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-50"
              >
                {actionPending === "end" ? "Ending…" : "End session"}
              </button>
            </div>
          </div>
        </section>
      </FadeUp>

      {actionError && (
        <FadeUp delay={0.04}>
          <div className="flex items-start gap-3 rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
            <Icon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 font-medium">{actionError}</p>
            <button
              type="button"
              onClick={clearError}
              className="text-xs font-bold underline"
            >
              Dismiss
            </button>
          </div>
        </FadeUp>
      )}

      {/* ONBOARD */}
      {onboard.length > 0 && (
        <FadeUp delay={0.05}>
          <section>
            <SectionHeader
              eyebrow="Onboard"
              title={`${onboard.length} rider${onboard.length === 1 ? "" : "s"} in the car`}
            />
            <ul className="mt-3 space-y-2.5">
              {onboard.map((h) => (
                <li
                  key={h.id}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-emerald-900">
                        {h.pickup} → {h.dropoff}
                      </p>
                      <p className="mt-0.5 text-[11px] text-emerald-800/80">
                        {h.distanceKm.toFixed(1)} km · {formatJMD(h.fareJmd)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onTransition(h.id, "completed")}
                        disabled={isPending(h.id, "completed")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Icon name="check-circle" className="h-3.5 w-3.5" />
                        {isPending(h.id, "completed")
                          ? "Settling…"
                          : `Drop off · ${formatJMD(h.fareJmd)}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => onTransition(h.id, "cancelled")}
                        disabled={isPending(h.id, "cancelled")}
                        className="rounded-full border border-emerald-700/30 bg-white px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </FadeUp>
      )}

      {/* ACCEPTED — heading to pickup */}
      {accepted.length > 0 && (
        <FadeUp delay={0.06}>
          <section>
            <SectionHeader
              eyebrow="On the way"
              title={`${accepted.length} pickup${accepted.length === 1 ? "" : "s"} pending`}
            />
            <ul className="mt-3 space-y-2.5">
              {accepted.map((h) => (
                <li
                  key={h.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-amber-900">
                        Pick up at {h.pickup}
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-800/80">
                        Going to {h.dropoff} · {h.distanceKm.toFixed(1)} km ·{" "}
                        {formatJMD(h.fareJmd)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onTransition(h.id, "picked_up")}
                        disabled={isPending(h.id, "picked_up") || seatsFull}
                        title={seatsFull ? "Vehicle full" : undefined}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-600/25 hover:-translate-y-0.5 hover:bg-amber-700 disabled:opacity-50 disabled:hover:-translate-y-0"
                      >
                        <Icon name="check-circle" className="h-3.5 w-3.5" />
                        {isPending(h.id, "picked_up")
                          ? "Boarding…"
                          : "Picked up"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onTransition(h.id, "cancelled")}
                        disabled={isPending(h.id, "cancelled")}
                        className="rounded-full border border-amber-700/30 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </FadeUp>
      )}

      {/* PENDING — waiting for accept */}
      <FadeUp delay={0.07}>
        <section>
          <SectionHeader
            eyebrow="Hails on this route"
            title={
              pending.length === 0
                ? "Waiting for the next rider…"
                : `${pending.length} rider${pending.length === 1 ? "" : "s"} hailing`
            }
            hint={
              seatsFull
                ? "Vehicle full — drop someone off before accepting more"
                : undefined
            }
          />
          {pending.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-line bg-surface-soft p-8 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-rajlo-red shadow-sm">
                <Icon name="navigation" className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-bold">No hails yet</p>
              <p className="mt-1 text-xs text-muted">
                Stay on this corridor — we&apos;re polling every 5s for new
                riders.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {pending.map((h) => (
                <li
                  key={h.id}
                  className="rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">
                          {h.pickup} → {h.dropoff}
                        </p>
                        {typeof h.proximityKm === "number" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
                            <Icon name="map-pin" className="h-2.5 w-2.5" />
                            {h.proximityKm < 1
                              ? `${Math.round(h.proximityKm * 1000)} m away`
                              : `${h.proximityKm.toFixed(1)} km away`}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {h.distanceKm.toFixed(1)} km · You earn ~
                        {formatJMD(Math.round(h.fareJmd * 0.85))}
                        {h.concession ? " · concession" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onTransition(h.id, "accepted")}
                      disabled={isPending(h.id, "accepted") || seatsFull}
                      title={seatsFull ? "Vehicle full" : undefined}
                      className="inline-flex items-center gap-1.5 rounded-full bg-rajlo-red px-4 py-2 text-xs font-bold text-white shadow-md shadow-rajlo-red/25 hover:-translate-y-0.5 hover:bg-primary-hover disabled:opacity-50 disabled:hover:-translate-y-0"
                    >
                      <Icon name="check-circle" className="h-3.5 w-3.5" />
                      {isPending(h.id, "accepted")
                        ? "Accepting…"
                        : `Accept · ${formatJMD(h.fareJmd)}`}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </FadeUp>
    </div>
  );
}

/* ════════════ Geolocation push hook ════════════ */

/**
 * While `enabled` is true, sample the browser geolocation every 15s
 * and POST it to the session position endpoint. No-ops cleanly when
 * the user denies permission or the browser doesn't support geo.
 *
 * 15s strikes the balance: granular enough that the matcher's
 * proximity sort feels live, infrequent enough that we don't drain
 * the driver's battery while they're parked at a stand.
 */
function useDriverPositionPush(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    const push = () => {
      if (cancelled) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          void fetch("/api/driver/route-taxi/sessions/position", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          }).catch(() => {
            /* offline / 5xx — next tick will retry */
          });
        },
        () => {
          /* permission denied / timeout — drop this tick silently */
        },
        { enableHighAccuracy: false, maximumAge: 10_000, timeout: 8_000 },
      );
    };

    push();
    const id = setInterval(push, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);
}

function SectionHeader({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-extrabold tracking-tight md:text-xl">
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function RouteTaxiSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full" rounded="2xl" />
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
