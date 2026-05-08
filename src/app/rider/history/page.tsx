"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { FadeUp } from "@/components/anim";
import { RateDialog } from "@/components/rate-dialog";
import { RideCardSkeleton } from "@/components/skeleton";
import { formatJMD } from "@/lib/jamaica";

/**
 * Rider trip history. Tabbed view of past + ongoing rides:
 *   - All       — everything (default)
 *   - Ongoing   — in-flight (requested/accepted/arrived/in_progress)
 *   - Cancelled — cancelled only
 *
 * Tapping a row routes to /rider/history/[rideId] for full detail
 * with the route map, status timeline, fare breakdown, etc.
 *
 * Inline "Rate now" still works on completed rides where the rider
 * hasn't rated yet — pops a dialog without leaving the list.
 */

type RideStatus =
  | "requested"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type HistoryRow = {
  id: string;
  status: RideStatus;
  pickup: { name: string; address: string };
  dropoff: { name: string; address: string };
  seats: number;
  fareJMD: number;
  requestedAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  cancellationReason: string | null;
  driverName: string | null;
  driverRating: number | null;
  driverRatingCount: number;
  myRatingStars: number | null;
  carpool: boolean;
};

type Tab = "all" | "ongoing" | "cancelled";

const TABS: { key: Tab; label: string; statusParam: string }[] = [
  { key: "all", label: "All", statusParam: "all" },
  { key: "ongoing", label: "Ongoing", statusParam: "ongoing" },
  { key: "cancelled", label: "Cancelled", statusParam: "cancelled" },
];

const PAGE_SIZE = 20;

export default function RiderHistoryPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [rowsByTab, setRowsByTab] = useState<Record<Tab, HistoryRow[]>>({
    all: [],
    ongoing: [],
    cancelled: [],
  });
  const [hasMoreByTab, setHasMoreByTab] = useState<Record<Tab, boolean>>({
    all: false,
    ongoing: false,
    cancelled: false,
  });
  const [loadingTab, setLoadingTab] = useState<Tab | null>("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateTarget, setRateTarget] = useState<HistoryRow | null>(null);

  const rows = rowsByTab[tab];
  const hasMore = hasMoreByTab[tab];

  // Fetch on tab change. Each tab gets its own server query so stale
  // state from a different tab doesn't bleed in.
  useEffect(() => {
    let cancelled = false;
    if (rowsByTab[tab].length > 0) return; // already loaded
    setLoadingTab(tab);
    setError(null);
    (async () => {
      try {
        const config = TABS.find((t) => t.key === tab)!;
        const res = await fetch(
          `/api/rider/rides/history?status=${config.statusParam}&limit=${PAGE_SIZE}&offset=0`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          rides: HistoryRow[];
          pagination: { hasMore: boolean };
        };
        if (cancelled) return;
        setRowsByTab((prev) => ({ ...prev, [tab]: json.rides }));
        setHasMoreByTab((prev) => ({
          ...prev,
          [tab]: json.pagination.hasMore,
        }));
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Couldn't load history");
      } finally {
        if (!cancelled) setLoadingTab(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const config = TABS.find((t) => t.key === tab)!;
      const offset = rowsByTab[tab].length;
      const res = await fetch(
        `/api/rider/rides/history?status=${config.statusParam}&limit=${PAGE_SIZE}&offset=${offset}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        rides: HistoryRow[];
        pagination: { hasMore: boolean };
      };
      setRowsByTab((prev) => ({
        ...prev,
        [tab]: [...prev[tab], ...json.rides],
      }));
      setHasMoreByTab((prev) => ({ ...prev, [tab]: json.pagination.hasMore }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more");
    } finally {
      setLoadingMore(false);
    }
  };

  // Quick stats — completed count + lifetime spending across the
  // currently-loaded rides. Real totals would come from a dedicated
  // aggregate endpoint; this is "what's loaded right now" which is
  // honest and snappy.
  const stats = useMemo(() => {
    const all = rowsByTab.all.length > 0 ? rowsByTab.all : rows;
    const completed = all.filter((r) => r.status === "completed");
    const spent = completed.reduce((s, r) => s + r.fareJMD, 0);
    return { tripsCompleted: completed.length, spent };
  }, [rowsByTab.all, rows]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2 md:px-3 md:py-8">
      <FadeUp>
        <div>
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Trip history
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">
            Your past rides
          </h1>
          <p className="mt-1 text-sm text-muted">
            Receipts, ratings, and re-booking — everything you&apos;ve done with
            Rajlo.
          </p>
        </div>
      </FadeUp>

      {/* Quick stats — completed + spent. Visually quiet so it doesn't
         compete with the trip list. The "Total spent" tile deep-links
         to /rider/analytics for the full breakdown (trend, parishes,
         top routes), which is what most riders are reaching for when
         they tap a money number anyway. */}
      <FadeUp delay={0.04}>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Completed trips"
            value={stats.tripsCompleted.toString()}
            icon="check-circle"
          />
          <StatCard
            label="Total spent"
            value={formatJMD(stats.spent)}
            icon="trending-up"
            href="/rider/analytics"
          />
        </div>
      </FadeUp>

      {/* Tabs */}
      <FadeUp delay={0.06}>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex gap-1 rounded-full border border-line bg-surface-soft p-1">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`relative rounded-full px-5 py-2 text-sm font-bold transition-all ${
                    active
                      ? "bg-rajlo-red text-white shadow-md shadow-rajlo-red/30"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {/* Show count pill if we've loaded this tab. */}
                  {rowsByTab[t.key].length > 0 && (
                    <span
                      className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-rajlo-red/10 text-rajlo-red"
                      }`}
                    >
                      {rowsByTab[t.key].length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </FadeUp>

      {/* Loading state — render 4 ride-card skeletons in the same
         shape the real list will take, so there's no layout shift. */}
      {loadingTab === tab && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <RideCardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && loadingTab !== tab && (
        <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
          {error}
        </div>
      )}

      {loadingTab !== tab && rows.length === 0 && !error && (
        <FadeUp delay={0.05}>
          <div className="rounded-3xl border border-line bg-surface p-10 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-soft text-muted">
              <Icon name="history" className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-xl font-extrabold tracking-tight">
              {tab === "ongoing"
                ? "No ongoing trips"
                : tab === "cancelled"
                  ? "No cancelled trips"
                  : "No trips yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {tab === "ongoing"
                ? "Book a ride to see it here while it's in progress."
                : tab === "cancelled"
                  ? "Cancelled trips will show up here."
                  : "Take your first Rajlo ride and the receipt lands here."}
            </p>
            <Link
              href="/rider/request"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white hover:bg-primary-hover"
            >
              Book a ride
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
        </FadeUp>
      )}

      {loadingTab !== tab && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((r) => (
            <HistoryCard key={r.id} row={r} onRate={() => setRateTarget(r)} />
          ))}

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-surface-soft disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-rajlo-red border-t-transparent" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {rateTarget && (
        <RateDialog
          endpoint={`/api/rider/rides/${rateTarget.id}/rate`}
          title={`Rate ${rateTarget.driverName ?? "your driver"}`}
          subtitle="Your feedback helps other riders pick the right driver."
          onClose={() => setRateTarget(null)}
          onSubmitted={(stars) => {
            // Optimistically update across all tabs that contain this row.
            setRowsByTab((prev) => {
              const update = (rs: HistoryRow[]) =>
                rs.map((r) =>
                  r.id === rateTarget.id ? { ...r, myRatingStars: stars } : r,
                );
              return {
                all: update(prev.all),
                ongoing: update(prev.ongoing),
                cancelled: update(prev.cancelled),
              };
            });
          }}
        />
      )}
    </div>
  );
}

/* ─────────── Stat card ─────────── */

function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string;
  icon: "check-circle" | "trending-up";
  /** Optional — when set, the whole card becomes a link, gains a
   *  subtle chevron, and lifts on hover. Used by the spend tile to
   *  deep-link into the analytics page. */
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {label}
        </p>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-rajlo-red">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-rajlo-red md:text-3xl">
        {value}
      </p>
      {href && (
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted transition-colors group-hover:text-rajlo-red">
          See breakdown
          <Icon name="chevron-right" className="h-3 w-3" />
        </p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-rajlo-red/30 hover:shadow-md"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">{inner}</div>
  );
}

/* ─────────── History card ─────────── */

function HistoryCard({ row, onRate }: { row: HistoryRow; onRate: () => void }) {
  const dateLabel = row.endedAt
    ? new Date(row.endedAt).toLocaleString("en-JM", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : new Date(row.requestedAt).toLocaleString("en-JM", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  const statusBadge = STATUS_BADGE[row.status];
  const isOngoing = [
    "requested",
    "accepted",
    "arrived",
    "in_progress",
  ].includes(row.status);

  return (
    <Link
      href={isOngoing ? "/rider/live-trip" : `/rider/history/${row.id}`}
      className="group block rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-rajlo-red/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadge.classes}`}
            >
              {statusBadge.label}
            </span>
            {row.carpool && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                <Icon name="users" className="h-3 w-3" />
                Carpool
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">{dateLabel}</p>
        </div>
        <p
          className={`text-lg font-extrabold tracking-tight ${
            row.status === "cancelled"
              ? "text-muted line-through"
              : "text-rajlo-red"
          }`}
        >
          {formatJMD(row.fareJMD)}
        </p>
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-[10px] font-extrabold text-white">
            A
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{row.pickup.name}</p>
            <p className="truncate text-xs text-muted">{row.pickup.address}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rajlo-red text-[10px] font-extrabold text-white">
            B
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{row.dropoff.name}</p>
            <p className="truncate text-xs text-muted">{row.dropoff.address}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">
            {row.driverName
              ? `Driver · ${row.driverName}`
              : "No driver assigned"}
          </p>
          {row.driverName && row.driverRating !== null && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
              <Icon name="star" className="h-3 w-3 text-rajlo-red" />
              {row.driverRating.toFixed(1)} · {row.driverRatingCount} rating
              {row.driverRatingCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {row.myRatingStars !== null ? (
          <p className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-rajlo-red">
            <Icon name="star" className="h-3.5 w-3.5" />
            You rated · {row.myRatingStars}
          </p>
        ) : row.status === "completed" && row.driverName ? (
          <button
            type="button"
            onClick={(e) => {
              // Don't navigate to the detail page — the user is asking
              // for the rate dialog instead.
              e.preventDefault();
              e.stopPropagation();
              onRate();
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rajlo-red/40 bg-primary-soft px-3 py-1 text-[11px] font-bold text-rajlo-red transition-colors hover:bg-rajlo-red hover:text-white"
          >
            <Icon name="star" className="h-3 w-3" />
            Rate now
          </button>
        ) : isOngoing ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        ) : null}
      </div>

      {row.status === "cancelled" && row.cancellationReason && (
        <p className="mt-3 rounded-xl bg-surface-soft px-3 py-2 text-xs text-muted">
          {row.cancellationReason}
        </p>
      )}
    </Link>
  );
}

const STATUS_BADGE: Record<RideStatus, { label: string; classes: string }> = {
  requested: {
    label: "Requested",
    classes: "bg-amber-100 text-amber-800",
  },
  accepted: {
    label: "Driver coming",
    classes: "bg-emerald-100 text-emerald-700",
  },
  arrived: {
    label: "At pickup",
    classes: "bg-emerald-100 text-emerald-700",
  },
  in_progress: {
    label: "In progress",
    classes: "bg-emerald-100 text-emerald-700",
  },
  completed: {
    label: "Completed",
    classes: "bg-emerald-100 text-emerald-700",
  },
  cancelled: {
    label: "Cancelled",
    classes: "bg-rajlo-black/10 text-rajlo-black",
  },
};
