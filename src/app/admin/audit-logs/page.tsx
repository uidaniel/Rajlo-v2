"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArcWatermark } from "@/components/arc-pattern";
import { Icon } from "@/components/icons";
import { FadeUp } from "@/components/anim";
import { Skeleton } from "@/components/skeleton";
import { LiveIndicator } from "@/components/live-indicator";
import { useLiveQuery } from "@/lib/use-live-query";

/**
 * /admin/audit-logs — combined audit feed.
 *
 * Surfaces every accountable action across the platform: admin
 * actions (deactivate, delete, invite, role change), driver
 * verification decisions, and the merged stream is searchable and
 * filterable so an admin can produce a "who did what to X" query
 * without writing SQL.
 */

type Entry = {
  id: string;
  source: "admin" | "driver";
  action: string;
  summary: string;
  actor: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  createdAt: string;
};

type SourceFilter = "all" | "admin" | "driver";
type TargetFilter = "all" | "rider" | "driver" | "admin" | "ride" | "system";

export default function AdminAuditLogsPage() {
  const [source, setSource] = useState<SourceFilter>("all");
  const [target, setTarget] = useState<TargetFilter>("all");
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // How many entries to fetch. "Load more" raises it; the API caps at
  // 2000. Without this the feed silently stopped at 200 entries with
  // no way to reach older ones.
  const [limit, setLimit] = useState(200);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const url = (() => {
    const params = new URLSearchParams();
    if (source !== "all") params.set("source", source);
    if (target !== "all") params.set("targetType", target);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("days", String(days));
    params.set("limit", String(limit));
    return `/api/admin/audit-logs?${params.toString()}`;
  })();

  // Audit log changes whenever an admin acts or a driver event lands —
  // a 15s cadence keeps the feed visibly current.
  const auditQuery = useLiveQuery<{ entries: Entry[] }>(url, {
    interval: 15_000,
  });
  // Stable derived value — wrap in useMemo so the `entries.forEach`
  // grouping doesn't churn `grouped` on every render.
  const entries = useMemo(
    () => auditQuery.data?.entries ?? [],
    [auditQuery.data?.entries],
  );
  const loading = auditQuery.loading;
  const error = auditQuery.error;

  // Group entries by date for visual scanning
  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    entries.forEach((e) => {
      const key = new Date(e.createdAt).toLocaleDateString("en-JM", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [entries]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-2 py-4 md:px-3 md:py-8">
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-xl md:p-9">
          <ArcWatermark
            size={420}
            variant="red"
            className="absolute -right-20 -bottom-20 opacity-[0.10]"
          />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Compliance trail
              </p>
              <LiveIndicator
                variant="dark"
                lastUpdated={auditQuery.lastUpdated}
                refreshing={auditQuery.refreshing}
                onRefresh={auditQuery.refresh}
              />
            </div>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              Audit logs
            </h1>
            <p className="mt-1 text-sm text-white/70 md:text-base">
              Every admin decision and every driver verification event,
              searchable across {days} day{days === 1 ? "" : "s"} · refreshes every 15s.
            </p>
          </div>
        </div>
      </FadeUp>

      {/* Filters */}
      <FadeUp delay={0.05}>
        <div className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "all", label: "All sources" },
                  { key: "admin", label: "Admin actions" },
                  { key: "driver", label: "Driver events" },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSource(s.key)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    source === s.key
                      ? "bg-rajlo-red text-white shadow-md shadow-rajlo-red/30"
                      : "bg-surface-soft text-muted hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <span className="mx-1 self-center h-5 w-px bg-line" />
              {(
                [
                  { key: "all", label: "Any target" },
                  { key: "rider", label: "Rider" },
                  { key: "driver", label: "Driver" },
                  { key: "admin", label: "Admin" },
                  { key: "ride", label: "Ride" },
                  { key: "system", label: "System" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTarget(t.key)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    target === t.key
                      ? "bg-rajlo-black text-white"
                      : "bg-surface-soft text-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value, 10))}
                className="rounded-full border border-line bg-surface-soft px-4 py-2 text-xs font-semibold focus:border-rajlo-red focus:outline-none"
              >
                <option value={1}>Last 24 hours</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last year</option>
                <option value={0}>All time</option>
              </select>
              <label className="relative flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search summary text…"
                  className="w-full rounded-full border border-line bg-surface-soft py-2 pl-9 pr-4 text-sm font-semibold focus:border-rajlo-red focus:outline-none"
                />
              </label>
            </div>
          </div>
        </div>
      </FadeUp>

      {/* Feed */}
      <FadeUp delay={0.08}>
        <div className="rounded-2xl border border-line bg-surface p-4 md:p-6">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" rounded="xl" />
              ))}
            </div>
          ) : error ? (
            <div className="grid place-items-center py-16 text-center">
              <Icon name="alert-triangle" className="h-8 w-8 text-rajlo-red" />
              <p className="mt-3 text-sm font-bold">{error}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <Icon name="history" className="h-8 w-8 text-muted" />
              <p className="mt-3 text-sm font-bold">No audit entries match these filters</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([day, items]) => (
                <div key={day}>
                  <p className="font-secondary mb-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                    {day} · {items.length} entr{items.length === 1 ? "y" : "ies"}
                  </p>
                  <ul className="space-y-2">
                    {items.map((e) => (
                      <EntryRow key={e.id} entry={e} />
                    ))}
                  </ul>
                </div>
              ))}

              {/* Load more — appears while the feed is saturated (more
                 entries likely exist) and we're under the API cap. */}
              {entries.length >= limit && limit < 2000 && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setLimit((l) => Math.min(2000, l + 300))}
                    className="rounded-full border border-line bg-surface-soft px-5 py-2 text-xs font-bold hover:bg-surface-2"
                  >
                    Load more
                  </button>
                  <p className="mt-2 text-[11px] text-muted">
                    Showing {entries.length}. Use the time range +
                    filters to narrow a large trail.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </FadeUp>
    </div>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  const tone =
    entry.action === "delete" || entry.action === "deactivate"
      ? "danger"
      : entry.action === "reactivate" ||
          entry.action === "approve" ||
          entry.action === "invite"
        ? "good"
        : entry.source === "driver"
          ? "neutral"
          : "info";
  const toneClass = {
    danger: "bg-primary-soft text-rajlo-red",
    good: "bg-emerald-50 text-emerald-700",
    neutral: "bg-surface-soft text-muted",
    info: "bg-blue-50 text-blue-700",
  }[tone];

  const inner = (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-soft px-4 py-3 transition-colors hover:bg-surface">
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneClass}`}
      >
        <Icon
          name={entry.source === "admin" ? "shield" : "shield-check"}
          className="h-4 w-4"
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-rajlo-black px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
            {entry.action}
          </span>
          {entry.targetType && (
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              {entry.targetType}
            </span>
          )}
          {entry.targetLabel && (
            <p className="truncate text-xs font-bold">{entry.targetLabel}</p>
          )}
        </div>
        <p className="mt-1.5 text-sm leading-relaxed">{entry.summary}</p>
        <p className="mt-1 text-[11px] text-muted">
          {entry.actor ?? "System"} · {new Date(entry.createdAt).toLocaleString("en-JM")}
        </p>
      </div>
    </div>
  );

  // Link admin-on-user actions back to the user profile
  const href =
    entry.targetId &&
    entry.targetType &&
    ["rider", "driver", "admin"].includes(entry.targetType)
      ? entry.targetType === "driver" && entry.targetId.startsWith("DRV-")
        ? `/admin/verification-detail?driverId=${entry.targetId}`
        : `/admin/users/${entry.targetId}`
      : entry.targetType === "ride"
        ? `/admin/rides/${entry.targetId}`
        : null;

  return <li>{href ? <Link href={href}>{inner}</Link> : inner}</li>;
}
