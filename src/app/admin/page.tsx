"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArcWatermark } from "@/components/arc-pattern";
import { Icon, type IconName } from "@/components/icons";
import { FadeUp, Stagger, StaggerItem } from "@/components/anim";

type QueueDriver = {
  id: string;
  externalId: string;
  name: string;
  plateNumber: string | null;
  status: string;
  submittedAt: string;
  docsUploaded: number;
  docsRejected: number;
};

export default function AdminHomePage() {
  const [drivers, setDrivers] = useState<QueueDriver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/verification-queue");
        if (!res.ok) return;
        const json = (await res.json()) as { drivers: QueueDriver[] };
        if (mounted) setDrivers(json.drivers ?? []);
      } catch {
        /* silent */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const pendingCount = drivers.filter((d) => d.status === "pending_review").length;
  const rejectedCount = drivers.filter((d) => d.status === "rejected").length;
  const longestWait = drivers
    .filter((d) => d.status === "pending_review")
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())[0];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-2 py-6 md:px-3 md:py-8">
      {/* ─── Hero ─── */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-xl md:p-10">
          <ArcWatermark size={420} variant="red" className="absolute -right-20 -bottom-20 opacity-[0.10]" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Operations console
              </p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                Welcome back.
              </h1>
              <p className="mt-1 text-sm text-white/70 md:text-base">
                {pendingCount > 0
                  ? `${pendingCount} driver${pendingCount === 1 ? "" : "s"} awaiting verification.`
                  : "No outstanding verifications. Great work."}
              </p>
            </div>
            <Link
              href="/admin/verification-queue"
              className="inline-flex items-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
            >
              Open verification queue
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </FadeUp>

      {/* ─── Stats ─── */}
      <Stagger className="grid gap-4 md:grid-cols-4">
        <Stat
          label="Pending review"
          value={loading ? "—" : String(pendingCount)}
          icon="clipboard-check"
          tone="amber"
        />
        <Stat
          label="Resubmit"
          value={loading ? "—" : String(rejectedCount)}
          icon="alert-triangle"
          tone="red"
        />
        <Stat
          label="Total in queue"
          value={loading ? "—" : String(drivers.length)}
          icon="inbox"
        />
        <Stat
          label="Longest wait"
          value={
            loading
              ? "—"
              : longestWait
                ? hoursAgo(longestWait.submittedAt)
                : "—"
          }
          icon="clock"
          tone={longestWait && hoursSince(longestWait.submittedAt) > 48 ? "red" : "default"}
        />
      </Stagger>

      {/* ─── Quick actions ─── */}
      <FadeUp delay={0.05}>
        <div>
          <p className="font-secondary mb-3 text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Quick actions
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <ActionCard
              icon="clipboard-check"
              label="Verification queue"
              desc="Review pending driver applications"
              href="/admin/verification-queue"
            />
            <ActionCard
              icon="map"
              label="Parishes & fares"
              desc="Manage parish-pair fare rules"
              href="/admin/fare-rules"
            />
            <ActionCard
              icon="activity"
              label="Live ride monitoring"
              desc="Watch active trips in real time"
              href="/admin/ride-monitoring"
            />
          </div>
        </div>
      </FadeUp>

      {/* ─── Recent submissions preview ─── */}
      <FadeUp delay={0.1}>
        <div className="rounded-2xl border border-line bg-surface p-5 md:p-7">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
              Latest submissions
            </p>
            <Link
              href="/admin/verification-queue"
              className="text-xs font-bold text-rajlo-red hover:underline"
            >
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="grid place-items-center py-10">
              <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-rajlo-red border-t-transparent" />
            </div>
          ) : drivers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No drivers awaiting verification right now.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {drivers.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/admin/verification-detail?driverId=${encodeURIComponent(d.externalId)}`}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-surface-soft"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white ${
                        d.status === "rejected" ? "bg-rajlo-red" : "bg-rajlo-black"
                      }`}
                    >
                      <Icon
                        name={d.status === "rejected" ? "alert-triangle" : "clipboard-check"}
                        className="h-4 w-4"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{d.name}</p>
                      <p className="truncate text-xs text-muted">
                        {d.externalId} · submitted {hoursAgo(d.submittedAt)}
                      </p>
                    </div>
                    <Icon name="chevron-right" className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FadeUp>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: "default" | "amber" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "text-rajlo-red"
      : tone === "amber"
        ? "text-amber-700"
        : "text-rajlo-red";
  const iconBg =
    tone === "red"
      ? "bg-primary-soft text-rajlo-red"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-primary-soft text-rajlo-red";
  return (
    <StaggerItem>
      <div className="rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${iconBg}`}>
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className={`mt-2 text-2xl font-extrabold tracking-tight md:text-3xl ${toneClass}`}>
          {value}
        </p>
      </div>
    </StaggerItem>
  );
}

function ActionCard({
  icon,
  label,
  desc,
  href,
}: {
  icon: IconName;
  label: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-rajlo-red hover:shadow-md"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-rajlo-red transition-colors group-hover:bg-rajlo-red group-hover:text-white">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{label}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      <Icon
        name="arrow-right"
        className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-rajlo-red"
      />
    </Link>
  );
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function hoursAgo(iso: string): string {
  const hrs = hoursSince(iso);
  if (hrs < 1) return `${Math.floor(hrs * 60)}m ago`;
  if (hrs < 24) return `${Math.floor(hrs)}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
