"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArcWatermark } from "@/components/arc-pattern";
import { Icon } from "@/components/icons";
import { FadeUp } from "@/components/anim";
import { HeroSkeleton, Skeleton } from "@/components/skeleton";
import { formatJMD } from "@/lib/jamaica";

/**
 * /admin/users/[id] — single-user audit profile.
 *
 * Pulls the full denormalised payload from /api/admin/users/[id] and
 * surfaces:
 *   - identity card (avatar, name, email, role, deactivation state)
 *   - quick stats (rides as rider, rides as driver, lifetime spend / earnings)
 *   - driver block (vehicle, plate, onboarding state, online state)
 *   - rating summary across both directions
 *   - audit-log entries that target this user
 *
 * Action bar at the top mirrors the row-level actions on /admin/users
 * so an admin can act without bouncing back.
 */

type UserDetail = {
  profile: {
    id: string;
    fullName: string;
    phone: string | null;
    role: "rider" | "driver" | "admin";
    createdAt: string;
    updatedAt: string;
  };
  auth: { email: string | null; lastSignInAt: string | null; banned: boolean };
  driver: null | {
    id: string;
    external_id: string;
    plate_number: string | null;
    vehicle_type: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_year: number | null;
    vehicle_color: string | null;
    activated: boolean;
    onboarding_status: string;
    deactivated_at: string | null;
    admin_note: string | null;
    is_online: boolean;
    went_online_at: string | null;
    submitted_at: string | null;
  };
  activity: {
    ridesAsRider: number;
    ridesAsDriver: number;
    lifetimeSpend: number;
    lifetimeEarnings: number;
    lastRideAt: string | null;
  };
  ratings: {
    asDriver: { count: number; average: number | null };
    asRider: { count: number; average: number | null };
    given: { count: number; average: number | null };
    latest: Array<{ stars: number; comment: string | null; created_at: string }>;
  };
  audits: Array<{
    id: string;
    action: string;
    summary: string;
    actor_label: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>;
};

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"deactivate" | "reactivate" | "delete" | null>(
    null,
  );

  const reload = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as UserDetail;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load user");
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const isDeactivated = data
    ? data.auth.banned ||
      (data.profile.role === "driver" && data.driver?.deactivated_at)
    : false;

  const handleDeactivate = async (reactivate: boolean) => {
    if (!data) return;
    if (!reactivate) {
      const reason = window.prompt(
        `Reason for deactivating ${data.profile.fullName}? (optional, shown in audit log)`,
        "",
      );
      if (reason === null) return;
      setBusy("deactivate");
      try {
        const res = await fetch(`/api/admin/users/${id}/deactivate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        await reload();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Couldn't deactivate");
      } finally {
        setBusy(null);
      }
      return;
    }
    if (!confirm(`Reactivate ${data.profile.fullName}?`)) return;
    setBusy("reactivate");
    try {
      const res = await fetch(
        `/api/admin/users/${id}/deactivate?action=reactivate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't reactivate");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!data) return;
    if (
      !confirm(
        `Delete ${data.profile.fullName} permanently?\n\nThis cascades through rides, ratings, documents, and chat history. There is no undo.`,
      )
    )
      return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      router.push("/admin/users");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't delete");
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-2 py-4 md:px-3 md:py-8">
        <HeroSkeleton />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" rounded="xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" rounded="xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Icon name="alert-triangle" className="mx-auto h-10 w-10 text-rajlo-red" />
        <p className="mt-4 text-sm font-bold">{error ?? "User not found"}</p>
        <Link
          href="/admin/users"
          className="mt-4 inline-block text-xs font-bold text-rajlo-red hover:underline"
        >
          ← Back to users
        </Link>
      </div>
    );
  }

  const initials = data.profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-2 py-4 md:px-3 md:py-8">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-rajlo-red"
      >
        <Icon name="chevron-left" className="h-3.5 w-3.5" />
        All users
      </Link>

      {/* Hero / identity card */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-xl md:p-9">
          <ArcWatermark
            size={460}
            variant="red"
            className="absolute -right-20 -bottom-20 opacity-[0.12]"
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <span
                className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-extrabold ${
                  data.profile.role === "driver"
                    ? "bg-rajlo-red text-white"
                    : data.profile.role === "admin"
                      ? "bg-white text-rajlo-black"
                      : "bg-emerald-500 text-white"
                }`}
              >
                {initials || "?"}
              </span>
              <div className="min-w-0">
                <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                  {data.profile.role.toUpperCase()}
                  {data.driver && ` · ${data.driver.external_id}`}
                </p>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">
                  {data.profile.fullName}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
                  {data.auth.email && (
                    <span className="flex items-center gap-1.5">
                      <Icon name="mail" className="h-3.5 w-3.5" />
                      {data.auth.email}
                    </span>
                  )}
                  {data.profile.phone && (
                    <span className="flex items-center gap-1.5">
                      <Icon name="phone" className="h-3.5 w-3.5" />
                      {data.profile.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Icon name="clock" className="h-3.5 w-3.5" />
                    Joined {ago(data.profile.createdAt)}
                  </span>
                </div>
                {isDeactivated && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rajlo-red px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
                    <Icon name="alert-triangle" className="h-3 w-3" />
                    Deactivated
                  </div>
                )}
                {data.driver?.is_online && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    Online now
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isDeactivated ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => handleDeactivate(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Icon name="check-circle" className="h-3.5 w-3.5" />
                  Reactivate
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => handleDeactivate(false)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Icon name="alert-triangle" className="h-3.5 w-3.5" />
                  Deactivate
                </button>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20 disabled:opacity-50"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </FadeUp>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <Stat
          eyebrow={data.profile.role === "driver" ? "Rides driven" : "Rides taken"}
          value={
            data.profile.role === "driver"
              ? data.activity.ridesAsDriver
              : data.activity.ridesAsRider
          }
          icon="navigation"
        />
        <Stat
          eyebrow={data.profile.role === "driver" ? "Earnings" : "Spend"}
          value={
            data.profile.role === "driver"
              ? formatJMD(data.activity.lifetimeEarnings)
              : formatJMD(data.activity.lifetimeSpend)
          }
          icon="trending-up"
        />
        <Stat
          eyebrow="Last activity"
          value={data.activity.lastRideAt ? ago(data.activity.lastRideAt) : "—"}
          icon="clock"
        />
        <Stat
          eyebrow="Last sign-in"
          value={data.auth.lastSignInAt ? ago(data.auth.lastSignInAt) : "Never"}
          icon="user"
        />
      </div>

      {/* Driver detail */}
      {data.driver && (
        <FadeUp delay={0.05}>
          <div className="rounded-2xl border border-line bg-surface p-5 md:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                  Driver record
                </p>
                <p className="mt-1 text-sm font-bold">
                  {data.driver.external_id} ·{" "}
                  <span className="text-muted">
                    Onboarding status:{" "}
                  </span>
                  <span
                    className={`font-extrabold ${
                      data.driver.activated
                        ? "text-emerald-700"
                        : data.driver.onboarding_status === "rejected"
                          ? "text-rajlo-red"
                          : "text-amber-700"
                    }`}
                  >
                    {data.driver.activated
                      ? "Active"
                      : data.driver.onboarding_status}
                  </span>
                </p>
              </div>
              <Link
                href={`/admin/verification-detail?driverId=${encodeURIComponent(data.driver.external_id)}`}
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1.5 text-[11px] font-extrabold text-rajlo-red hover:bg-rajlo-red hover:text-white"
              >
                Open verification
                <Icon name="arrow-right" className="h-3 w-3" />
              </Link>
            </div>
            <dl className="grid gap-3 text-sm md:grid-cols-3">
              <DetailRow label="Plate" value={data.driver.plate_number} />
              <DetailRow label="Vehicle type" value={data.driver.vehicle_type} />
              <DetailRow
                label="Make / model"
                value={
                  [data.driver.vehicle_make, data.driver.vehicle_model]
                    .filter(Boolean)
                    .join(" ") || null
                }
              />
              <DetailRow
                label="Year"
                value={data.driver.vehicle_year?.toString() ?? null}
              />
              <DetailRow label="Colour" value={data.driver.vehicle_color} />
              <DetailRow
                label="Submitted"
                value={
                  data.driver.submitted_at
                    ? new Date(data.driver.submitted_at).toLocaleString("en-JM")
                    : null
                }
              />
            </dl>
            {data.driver.admin_note && (
              <div className="mt-4 rounded-xl bg-primary-soft px-4 py-3">
                <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                  Admin note
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {data.driver.admin_note}
                </p>
              </div>
            )}
          </div>
        </FadeUp>
      )}

      {/* Ratings */}
      <FadeUp delay={0.08}>
        <div className="rounded-2xl border border-line bg-surface p-5 md:p-7">
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
            Ratings
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <RatingTile
              label={data.profile.role === "driver" ? "Received as driver" : "Received as rider"}
              count={
                data.profile.role === "driver"
                  ? data.ratings.asDriver.count
                  : data.ratings.asRider.count
              }
              average={
                data.profile.role === "driver"
                  ? data.ratings.asDriver.average
                  : data.ratings.asRider.average
              }
            />
            <RatingTile
              label="Given to others"
              count={data.ratings.given.count}
              average={data.ratings.given.average}
            />
            <RatingTile
              label="Last 5 received"
              count={data.ratings.latest.length}
              average={null}
            />
          </div>
          {data.ratings.latest.length > 0 && (
            <ul className="mt-4 space-y-2 text-xs">
              {data.ratings.latest.map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-xl border border-line bg-surface-soft px-3 py-2"
                >
                  <span className="text-rajlo-red">{"★".repeat(r.stars)}</span>
                  <p className="min-w-0 flex-1 truncate">
                    {r.comment ?? <span className="italic text-muted">No comment</span>}
                  </p>
                  <span className="shrink-0 text-[10px] text-muted">
                    {ago(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FadeUp>

      {/* Audit log */}
      <FadeUp delay={0.1}>
        <div className="rounded-2xl border border-line bg-surface p-5 md:p-7">
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
            Audit trail
          </p>
          <p className="mt-1 mb-4 text-sm font-bold">
            Admin actions targeting this user
          </p>
          {data.audits.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">
              No audit entries yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.audits.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-line bg-surface-soft px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-rajlo-black px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      {a.action}
                    </span>
                    <span className="text-xs font-semibold text-muted">
                      {a.actor_label ?? "—"} · {ago(a.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm">{a.summary}</p>
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
  eyebrow,
  value,
  icon,
}: {
  eyebrow: string;
  value: string | number;
  icon: "navigation" | "trending-up" | "clock" | "user";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between">
        <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
          {eyebrow}
        </p>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-rajlo-red">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight md:text-2xl">
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-0.5 truncate font-semibold">{value ?? "—"}</p>
    </div>
  );
}

function RatingTile({
  label,
  count,
  average,
}: {
  label: string;
  count: number;
  average: number | null;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-soft p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-extrabold tracking-tight">
          {average !== null ? average.toFixed(1) : "—"}
        </p>
        <p className="text-xs text-muted">
          {count} rating{count === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const months = Math.floor(d / 30);
  return `${months}mo ago`;
}
