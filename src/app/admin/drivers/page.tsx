"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { ListRowSkeleton } from "@/components/skeleton";
import { useLiveQuery } from "@/lib/use-live-query";

/**
 * /admin/drivers — Dedicated driver management.
 *
 * Replaces the all-in-one /admin/users for the driver slice. Lists
 * every driver on the platform, with filters that match the actual
 * lifecycle (approved, pending, rejected, deactivated, AND the
 * critical "needs review" cohort — drivers who've re-uploaded a
 * previously-approved doc that admin hasn't re-approved yet).
 *
 * Click a row → drops into the existing /admin/verification-detail
 * flow which already handles per-doc approve/reject + driver
 * deactivation. So this page is the queue, that page is the action.
 */

type DriverRow = {
  id: string;
  externalId: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  plateNumber: string | null;
  vehicle: string | null;
  onboardingStatus: string;
  activated: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  submittedAt: string | null;
  needsReview: boolean;
  docCounts: {
    approved: number;
    pending: number;
    rejected: number;
    missing: number;
  };
};

type StatusFilter =
  | "all"
  | "approved"
  | "pending_review"
  | "rejected"
  | "deactivated"
  | "needs_review";

const STATUS_TABS: { key: StatusFilter; label: string; tone: string }[] = [
  { key: "all", label: "All", tone: "muted" },
  { key: "needs_review", label: "Needs review", tone: "amber" },
  { key: "pending_review", label: "Pending verification", tone: "amber" },
  { key: "approved", label: "Active", tone: "emerald" },
  { key: "rejected", label: "Rejected", tone: "red" },
  { key: "deactivated", label: "Deactivated", tone: "muted" },
];

export default function AdminDriversPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("limit", "200");
    return `/api/admin/drivers?${params.toString()}`;
  }, [statusFilter, debouncedSearch]);

  const driversQuery = useLiveQuery<{ drivers: DriverRow[]; total: number }>(
    url,
    { interval: 30_000 },
  );

  const drivers = driversQuery.data?.drivers ?? [];
  const loading = !driversQuery.data && !driversQuery.error;

  // Compute the "Needs review" badge count for the tab so admin sees
  // the queue depth at a glance even when on a different filter.
  const needsReviewCount =
    statusFilter === "needs_review"
      ? drivers.length
      : drivers.filter((d) => d.needsReview).length;

  return (
    <div className="space-y-6">
      <FadeUp>
        <section className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-xl shadow-rajlo-black/30 md:p-10">
          <ArcWatermark
            size={520}
            variant="white"
            className="absolute -right-24 -top-24 opacity-[0.06]"
          />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Driver management
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                Drivers
              </h1>
              <p className="mt-1 text-sm text-white/75">
                Every driver, full lifecycle. Tap a row to open verification +
                actions.
              </p>
            </div>
            {needsReviewCount > 0 && statusFilter !== "needs_review" && (
              <button
                type="button"
                onClick={() => setStatusFilter("needs_review")}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-rajlo-black shadow-md shadow-amber-500/30 hover:-translate-y-0.5"
              >
                <Icon name="alert-triangle" className="h-4 w-4" />
                {needsReviewCount} need{needsReviewCount === 1 ? "s" : ""} review
              </button>
            )}
          </div>
        </section>
      </FadeUp>

      <FadeUp delay={0.04}>
        <section className="rounded-3xl border border-line bg-surface p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search drivers</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, plate, or driver ID"
                className="block w-full rounded-xl border border-line bg-surface-soft py-2.5 pl-10 pr-4 text-sm font-medium outline-none placeholder:text-muted focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/20"
              />
            </label>
          </div>

          <div className="-mx-1 mt-3 flex flex-wrap gap-1.5">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatusFilter(t.key)}
                className={`relative rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  statusFilter === t.key
                    ? "bg-rajlo-red text-white"
                    : "border border-line bg-surface text-muted hover:border-rajlo-red hover:text-rajlo-red"
                }`}
              >
                {t.label}
                {t.key === "needs_review" &&
                  needsReviewCount > 0 &&
                  statusFilter !== "needs_review" && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-rajlo-black">
                      {needsReviewCount}
                    </span>
                  )}
              </button>
            ))}
          </div>
        </section>
      </FadeUp>

      {driversQuery.error && (
        <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
          Couldn&apos;t load drivers: {driversQuery.error}
        </div>
      )}

      {loading && (
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <ListRowSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && drivers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface-soft p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-rajlo-red shadow-sm">
            <Icon name="user" className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-bold">No drivers match these filters</p>
          <p className="mt-1 text-xs text-muted">
            {statusFilter === "needs_review"
              ? "Nothing in the re-review queue right now."
              : "Try a different status or clear the search."}
          </p>
        </div>
      )}

      {!loading && drivers.length > 0 && (
        <>
          {/* Mobile cards */}
          <ul className="space-y-2.5 md:hidden">
            {drivers.map((d) => (
              <DriverCardMobile key={d.id} driver={d} />
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft text-[10px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Driver</th>
                  <th className="px-4 py-3 text-left">Vehicle</th>
                  <th className="px-4 py-3 text-center">Documents</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Onboarded</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d, i) => (
                  <DriverRowDesktop key={d.id} driver={d} first={i === 0} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════ Mobile card ════════════════ */

function DriverCardMobile({ driver }: { driver: DriverRow }) {
  return (
    <li>
      <Link
        href={`/admin/verification-detail?driverId=${encodeURIComponent(driver.externalId)}`}
        className={`block rounded-2xl border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-rajlo-red/30 hover:shadow-md ${
          driver.needsReview ? "border-amber-300" : "border-line"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{driver.fullName}</p>
            <p className="text-[11px] text-muted">
              {driver.externalId}
              {driver.plateNumber ? ` · ${driver.plateNumber}` : ""}
            </p>
          </div>
          <StatusBadge driver={driver} />
        </div>
        {driver.vehicle && (
          <p className="mt-2 text-xs text-muted">{driver.vehicle}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          {driver.needsReview && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 ring-1 ring-amber-300">
              <Icon name="alert-triangle" className="h-2.5 w-2.5" />
              Re-uploaded
            </span>
          )}
          <DocCounts counts={driver.docCounts} />
        </div>
      </Link>
    </li>
  );
}

/* ════════════════ Desktop row ════════════════ */

function DriverRowDesktop({
  driver,
  first,
}: {
  driver: DriverRow;
  first: boolean;
}) {
  return (
    <tr
      className={`${first ? "" : "border-t border-line"} ${
        driver.needsReview ? "bg-amber-50/40" : ""
      }`}
    >
      <td className="px-4 py-3">
        <Link
          href={`/admin/verification-detail?driverId=${encodeURIComponent(driver.externalId)}`}
          className="block hover:text-rajlo-red"
        >
          <p className="font-bold">{driver.fullName}</p>
          <p className="text-[11px] text-muted">
            {driver.externalId}
            {driver.email ? ` · ${driver.email}` : ""}
          </p>
        </Link>
      </td>
      <td className="px-4 py-3">
        <p className="font-bold">{driver.plateNumber ?? "—"}</p>
        <p className="text-[11px] text-muted">{driver.vehicle ?? ""}</p>
      </td>
      <td className="px-4 py-3 text-center">
        <DocCounts counts={driver.docCounts} />
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <StatusBadge driver={driver} />
          {driver.needsReview && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-900 ring-1 ring-amber-300">
              <Icon name="alert-triangle" className="h-2.5 w-2.5" />
              Re-uploaded
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="text-[11px] text-muted">
          {ago(driver.submittedAt ?? driver.createdAt)}
        </p>
      </td>
    </tr>
  );
}

/* ════════════════ Helpers ════════════════ */

function StatusBadge({ driver }: { driver: DriverRow }) {
  const meta = (() => {
    if (driver.deactivatedAt) {
      return { label: "Deactivated", classes: "bg-surface-soft text-muted ring-line" };
    }
    if (driver.onboardingStatus === "approved" && driver.activated) {
      return {
        label: "Active",
        classes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      };
    }
    if (driver.onboardingStatus === "rejected") {
      return {
        label: "Rejected",
        classes: "bg-primary-soft text-rajlo-red ring-rajlo-red/30",
      };
    }
    if (driver.onboardingStatus === "pending_review") {
      return {
        label: "Pending review",
        classes: "bg-amber-50 text-amber-800 ring-amber-200",
      };
    }
    return {
      label: driver.onboardingStatus,
      classes: "bg-surface-soft text-muted ring-line",
    };
  })();
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}

function DocCounts({
  counts,
}: {
  counts: DriverRow["docCounts"];
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {counts.approved > 0 && (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          ✓ {counts.approved}
        </span>
      )}
      {counts.pending > 0 && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
          ⏳ {counts.pending}
        </span>
      )}
      {counts.rejected > 0 && (
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-rajlo-red ring-1 ring-rajlo-red/30">
          ✗ {counts.rejected}
        </span>
      )}
      {counts.missing > 0 && (
        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-bold text-muted ring-1 ring-line">
          — {counts.missing}
        </span>
      )}
    </div>
  );
}

function ago(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
