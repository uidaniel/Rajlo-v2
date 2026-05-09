"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp, Stagger, StaggerItem } from "@/components/anim";
import { ListRowSkeleton, Skeleton } from "@/components/skeleton";
import { useBackgroundRefresh } from "@/lib/use-background-refresh";
import { formatJMD } from "@/lib/jamaica";

/**
 * Mode B — Route Taxi catalogue.
 *
 * The rider browses the TA-licensed corridor list grouped by parish,
 * picks an origin → destination pair, sees the regulated fare, and
 * hails the next available route taxi. Hail creates a `route_hails`
 * row in `requested` state; Phase 2 wires the live driver-session
 * matcher and seat counter.
 *
 * Real data only — every route, distance, and fare comes from the TA
 * 2023 fare table seeded via `scripts/seed-routes.mjs`.
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

type Quote = {
  fareJmd: number;
  concessionFareJmd: number;
  distanceKm: number;
  source: "ta_table" | "formula";
};

type HailState =
  | { state: "idle" }
  | { state: "loading" }
  | {
      state: "success";
      hailId: string;
      fareJmd: number;
      origin: string;
      destination: string;
    }
  | { state: "error"; message: string; needsTopup?: boolean };

type ActiveHail = {
  id: string;
  routeId: string;
  status: "requested" | "accepted" | "picked_up";
  pickup: string;
  dropoff: string;
  distanceKm: number;
  fareJmd: number;
  concession: boolean;
  requestedAt: string;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  session: {
    id: string;
    seatsTaken: number;
    vehicleCapacity: number;
    driver: {
      firstName: string | null;
      plateNumber: string | null;
      vehicleMake: string | null;
      vehicleModel: string | null;
      vehicleColor: string | null;
    } | null;
  } | null;
};

export default function RiderRouteTaxiPage() {
  const [routes, setRoutes] = useState<RouteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [parishFilter, setParishFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<RouteRow | null>(null);
  const [concession, setConcession] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [hail, setHail] = useState<HailState>({ state: "idle" });
  const [activeHail, setActiveHail] = useState<ActiveHail | null>(null);
  // Rider-shared GPS for the pickup. Default ON because the driver
  // experience is dramatically better with it (proximity sort, "X km
  // away" badges) — riders can opt out if they prefer.
  const [shareLocation, setShareLocation] = useState(true);
  // Don't dump 466 routes on the rider — search-first UX with a small
  // visible window. They can expand if they really want to browse.
  const VISIBLE_LIMIT = 15;
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT);

  // Pull the rider's in-flight hail (if any). Drives the live status
  // banner at the top of the page and clears the local hail-success
  // state once the trip settles on the driver side.
  const refreshActiveHail = useCallback(async () => {
    try {
      const res = await fetch("/api/rider/route-taxi/hails/active");
      if (!res.ok) return;
      const json = (await res.json()) as { hail: ActiveHail | null };
      setActiveHail(json.hail);
      if (!json.hail) {
        setHail((cur) => (cur.state === "success" ? { state: "idle" } : cur));
      }
    } catch {
      /* polling — next tick will catch up */
    }
  }, []);

  useEffect(() => {
    void refreshActiveHail();
  }, [refreshActiveHail]);

  // Poll every 5s while an in-flight hail exists. Stops once the hail
  // settles (driver completes or cancels) so we don't burn battery.
  useBackgroundRefresh(refreshActiveHail, 5000, {
    enabled: Boolean(activeHail),
  });

  // Fetch the catalogue once.
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
          setError(
            e instanceof Error ? e.message : "Couldn't load route catalogue.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-quote when the rider picks a new route or toggles concession.
  useEffect(() => {
    if (!selected) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/rider/route-taxi/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routeId: selected.id }),
        });
        if (!res.ok) throw new Error("Quote failed");
        const json = (await res.json()) as Quote;
        if (cancelled) return;
        setQuote(json);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const parishes = useMemo(() => {
    if (!routes) return [];
    const set = new Set<string>();
    for (const r of routes) if (r.parish) set.add(r.parish);
    return Array.from(set).sort();
  }, [routes]);

  // Filtered, capped, grouped view. We surface both the visible
  // window AND the total filtered count so the "Show all" expand can
  // tell the rider exactly how many more routes are hidden.
  const { grouped, filteredCount } = useMemo(() => {
    if (!routes) return { grouped: [], filteredCount: 0 };
    const q = search.trim().toLowerCase();
    const filtered = routes.filter((r) => {
      if (parishFilter && r.parish !== parishFilter) return false;
      if (!q) return true;
      return (
        r.origin.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q)
      );
    });
    const visible = filtered.slice(0, visibleLimit);
    const groups = new Map<string, RouteRow[]>();
    for (const r of visible) {
      const key = r.parish ?? "Other";
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return {
      grouped: Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([parish, rows]) => ({ parish, rows })),
      filteredCount: filtered.length,
    };
  }, [routes, search, parishFilter, visibleLimit]);

  // Reset the visible cap whenever the rider changes their filter so
  // they're not stuck looking at an expanded view of a totally
  // different result set.
  useEffect(() => {
    setVisibleLimit(VISIBLE_LIMIT);
  }, [search, parishFilter]);

  const submitHail = async () => {
    if (!selected) return;
    setHail({ state: "loading" });

    // Best-effort GPS capture. We don't block the hail on it — if the
    // permission prompt times out (8s) or the user denies, the hail
    // still goes through, just without proximity hints for the driver.
    let pickupCoords: { pickupLat: number; pickupLng: number } | null = null;
    if (shareLocation && typeof navigator !== "undefined" && navigator.geolocation) {
      pickupCoords = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              pickupLat: pos.coords.latitude,
              pickupLng: pos.coords.longitude,
            });
          },
          () => resolve(null),
          { enableHighAccuracy: false, maximumAge: 30_000, timeout: 8_000 },
        );
      });
    }

    try {
      const res = await fetch("/api/rider/route-taxi/hail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: selected.id,
          concession,
          ...(pickupCoords ?? {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        hail?: { id: string; fareJmd: number };
        route?: { origin: string; destination: string };
        error?: string;
        message?: string;
        fareJmd?: number;
      };
      if (res.status === 402) {
        setHail({
          state: "error",
          message: json.message ?? "Top up your wallet to hail this trip.",
          needsTopup: true,
        });
        return;
      }
      if (!res.ok || !json.ok || !json.hail || !json.route) {
        setHail({
          state: "error",
          message:
            json.message ?? json.error ?? "Couldn't place the hail. Try again.",
        });
        return;
      }
      setHail({
        state: "success",
        hailId: json.hail.id,
        fareJmd: json.hail.fareJmd,
        origin: json.route.origin,
        destination: json.route.destination,
      });
      // Pick up the live status row immediately rather than waiting
      // for the next poll tick.
      void refreshActiveHail();
    } catch {
      setHail({
        state: "error",
        message: "Network glitch — your hail didn't go through.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ============== LIVE HAIL STATUS ============== */}
      {activeHail && (
        <FadeUp>
          <ActiveHailBanner hail={activeHail} />
        </FadeUp>
      )}

      {/* ============== HERO ============== */}
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
              Catch the next route taxi
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/75 md:text-base">
              Regulated TA fares. Pay from your wallet — no cash. Pick the
              corridor you&apos;re travelling and we&apos;ll hail the next car
              on that route.
            </p>
            <div className="mt-7 grid gap-2 sm:grid-cols-3 sm:gap-3">
              <TrustChip
                icon="check-circle"
                label="Regulated TA fare"
                hint="Same as the ta.org.jm published rate"
              />
              <TrustChip
                icon="shield-check"
                label="Verified red-plate driver"
                hint="No unlicensed cars on Rajlo"
              />
              <TrustChip
                icon="wallet"
                label="Wallet-only · zero cash"
                hint="Auto-debited at the end of your leg"
              />
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ============== PICKER ============== */}
      <FadeUp delay={0.05}>
        <section className="rounded-3xl border border-line bg-surface p-5 md:p-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-secondary text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
                Choose your corridor
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">
                {routes
                  ? `${routes.length.toLocaleString()} TA-licensed routes`
                  : "Loading routes…"}
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

          {/* Search + parish chips */}
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
                        ? "bg-rajlo-red text-white shadow-sm shadow-rajlo-red/30"
                        : "border border-line bg-surface text-muted hover:border-rajlo-red hover:text-rajlo-red"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Routes list (skeleton → grouped → empty) */}
          <div className="mt-5">
            {error && (
              <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
                {error}
              </div>
            )}

            {!routes && !error && (
              <div className="space-y-2.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <ListRowSkeleton key={i} />
                ))}
              </div>
            )}

            {routes && grouped.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line bg-surface-soft p-8 text-center">
                <p className="text-sm font-bold">No matching routes</p>
                <p className="mt-1 text-xs text-muted">
                  Try a different search or clear the parish filter.
                </p>
              </div>
            )}

            {routes && grouped.length > 0 && filteredCount > visibleLimit && (
              <p className="mb-3 rounded-xl bg-surface-soft px-3 py-2 text-[11px] text-muted">
                Showing {visibleLimit} of {filteredCount} matching routes —
                refine your search above for the exact one.
              </p>
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
                              onClick={() => {
                                setSelected(r);
                                setHail({ state: "idle" });
                              }}
                              className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                                selected?.id === r.id
                                  ? "border-rajlo-red bg-primary-soft"
                                  : "border-line bg-surface hover:-translate-y-0.5 hover:border-rajlo-red hover:shadow-md"
                              }`}
                            >
                              <span
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                                  selected?.id === r.id
                                    ? "bg-rajlo-red text-white"
                                    : "bg-surface-soft text-muted group-hover:bg-rajlo-red group-hover:text-white"
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
                                <p className="truncate text-[11px] text-muted">
                                  {r.distanceKm.toFixed(1)} km
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-extrabold tracking-tight text-rajlo-red">
                                {formatJMD(r.taFareJmd)}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            )}

            {routes && grouped.length > 0 && filteredCount > visibleLimit && (
              <button
                type="button"
                onClick={() => setVisibleLimit((v) => v + 30)}
                className="mt-4 w-full rounded-2xl border-2 border-dashed border-line bg-surface-soft px-4 py-3 text-sm font-bold text-foreground hover:border-rajlo-red hover:text-rajlo-red"
              >
                Show {Math.min(30, filteredCount - visibleLimit)} more
                <span className="ml-2 text-xs font-medium text-muted">
                  ({filteredCount - visibleLimit} remaining)
                </span>
              </button>
            )}
          </div>
        </section>
      </FadeUp>

      {/* ============== STICKY QUOTE / HAIL ============== */}
      {selected && (
        <FadeUp delay={0.05}>
          <section className="sticky bottom-4 z-20 rounded-3xl border border-line bg-surface p-5 shadow-2xl shadow-rajlo-red/10 md:p-6">
            {hail.state === "success" ? (
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rajlo-red text-white shadow-md shadow-rajlo-red/30">
                  <Icon name="check-circle" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                    Hail placed
                  </p>
                  <p className="mt-0.5 truncate text-sm font-extrabold tracking-tight md:text-base">
                    Looking for the next car · {hail.origin} → {hail.destination}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatJMD(hail.fareJmd)} · auto-debited from your wallet at
                    the end of your leg
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setHail({ state: "idle" });
                  }}
                  className="hidden shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted hover:bg-surface-soft sm:inline-flex"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
                <div className="min-w-0 flex-1">
                  <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                    Selected
                  </p>
                  <p className="mt-0.5 truncate text-sm font-extrabold tracking-tight md:text-base">
                    {selected.origin}{" "}
                    <span className="text-rajlo-red">→</span>{" "}
                    {selected.destination}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {selected.distanceKm.toFixed(1)} km · TA-regulated route
                  </p>
                  <label className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={concession}
                      onChange={(e) => setConcession(e.target.checked)}
                      className="h-4 w-4 accent-rajlo-red"
                    />
                    I&apos;m a student, senior, or qualify for half-fare
                  </label>
                  <label className="mt-2 flex items-start gap-2 text-[12px] font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={shareLocation}
                      onChange={(e) => setShareLocation(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-rajlo-red"
                    />
                    <span>
                      Share my pickup location
                      <span className="ml-1 text-[11px] font-normal text-muted">
                        — drivers nearest to you see your hail first
                      </span>
                    </span>
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-[140px] rounded-2xl bg-rajlo-black px-4 py-3 text-white">
                    <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-white/60">
                      Fare
                    </p>
                    {quoteLoading || !quote ? (
                      <Skeleton
                        className="mt-1 h-7 w-20 bg-white/10"
                        rounded="md"
                      />
                    ) : (
                      <p className="mt-0.5 text-2xl font-extrabold tracking-tight md:text-3xl">
                        {formatJMD(
                          concession ? quote.concessionFareJmd : quote.fareJmd,
                        )}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={submitHail}
                    disabled={hail.state === "loading" || !quote}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:-translate-y-0"
                  >
                    {hail.state === "loading" ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-white border-t-transparent" />
                        Hailing…
                      </>
                    ) : (
                      <>
                        Hail next car
                        <Icon name="arrow-right" className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {hail.state === "error" && (
              <div
                className={`mt-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
                  hail.needsTopup
                    ? "border border-amber-200 bg-amber-50 text-amber-900"
                    : "border border-rajlo-red/30 bg-primary-soft text-rajlo-red"
                }`}
              >
                <Icon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">{hail.message}</p>
                  {hail.needsTopup && (
                    <Link
                      href="/rider/wallet"
                      className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-rajlo-red px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary-hover"
                    >
                      Top up wallet
                      <Icon name="arrow-right" className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </section>
        </FadeUp>
      )}
    </div>
  );
}

function ActiveHailBanner({ hail }: { hail: ActiveHail }) {
  const status = hail.status;
  const driver = hail.session?.driver;
  const driverLine = driver?.firstName
    ? `${driver.firstName}${
        driver.vehicleMake && driver.vehicleModel
          ? ` · ${driver.vehicleColor ?? ""} ${driver.vehicleMake} ${driver.vehicleModel}`.trim()
          : ""
      }${driver.plateNumber ? ` · ${driver.plateNumber}` : ""}`
    : null;

  const eyebrow =
    status === "requested"
      ? "Searching for the next car"
      : status === "accepted"
        ? "Driver on the way"
        : "Onboard · trip in progress";
  const accentClass =
    status === "requested"
      ? "border-amber-300 bg-amber-50"
      : status === "accepted"
        ? "border-rajlo-red/30 bg-primary-soft"
        : "border-emerald-300 bg-emerald-50";
  const eyebrowColor =
    status === "picked_up" ? "text-emerald-700" : "text-rajlo-red";

  return (
    <div
      className={`relative flex flex-col gap-4 overflow-hidden rounded-3xl border p-5 md:flex-row md:items-center md:p-6 ${accentClass}`}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rajlo-red text-white shadow-md shadow-rajlo-red/30">
        <Icon name="navigation" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rajlo-red opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rajlo-red" />
          </span>
          <span
            className={`font-secondary text-[10px] font-bold uppercase tracking-wider ${eyebrowColor}`}
          >
            {eyebrow}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm font-extrabold tracking-tight md:text-base">
          {hail.pickup} → {hail.dropoff}
        </p>
        {driverLine ? (
          <p className="mt-0.5 truncate text-xs text-foreground/80">
            {driverLine}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">
            We&apos;re notifying drivers running this corridor — usually under
            a minute.
          </p>
        )}
        {hail.session && (
          <p className="mt-1 text-[11px] font-medium text-foreground/70">
            Seats {hail.session.seatsTaken}/{hail.session.vehicleCapacity} taken
          </p>
        )}
      </div>
      <div className="rounded-2xl bg-white/80 px-4 py-2.5 text-right">
        <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
          Fare
        </p>
        <p className="text-xl font-extrabold tracking-tight text-rajlo-red md:text-2xl">
          {formatJMD(hail.fareJmd)}
        </p>
      </div>
    </div>
  );
}

function TrustChip({
  icon,
  label,
  hint,
}: {
  icon: "check-circle" | "shield-check" | "wallet";
  label: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-bold">{label}</p>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-white/65">{hint}</p>
    </div>
  );
}
