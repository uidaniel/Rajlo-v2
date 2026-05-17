"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/skeleton";

/**
 * /admin/fraud/[userId] — full fraud profile for one account.
 *
 * Shows the risk score + its breakdown, every fraud flag, device
 * fingerprints, linked accounts (device/IP overlap), and
 * investigations — with the admin actions to recalculate, flag,
 * investigate, and resolve. All mutations go through
 * POST /api/admin/fraud/[userId] (gated by `manage_fraud`).
 */

type Detail = {
  user: { id: string; name: string; role: string };
  riskScore: {
    score: number;
    level: string;
    breakdown: Record<string, number>;
    lastCalculatedAt: string;
  } | null;
  flags: {
    id: string;
    flag_type: string;
    severity: string;
    description: string;
    created_at: string;
    resolved_at: string | null;
  }[];
  fingerprints: {
    fingerprint_hash: string;
    ip_address: string | null;
    device_type: string | null;
    os_version: string | null;
    created_at: string;
  }[];
  linkedAccounts: { userId: string; name: string }[];
  investigations: {
    id: string;
    status: string;
    summary: string;
    resolution: string | null;
    created_at: string;
  }[];
};

const LEVEL_STYLE: Record<string, string> = {
  low: "bg-surface-soft text-muted",
  moderate: "bg-amber-50 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-primary-soft text-rajlo-red",
};

export default function FraudUserPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/fraud/${userId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail((await res.json()) as Detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/fraud/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  // Enforcement actions route to the moderation API.
  const moderate = async (action: string, reason: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/moderation/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enforcement failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-8">
        <Skeleton className="h-64 w-full" rounded="lg" />
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-8">
        <p className="text-sm text-rajlo-red">{error ?? "Not found."}</p>
      </div>
    );
  }

  const { user, riskScore, flags, fingerprints, linkedAccounts, investigations } =
    detail;

  return (
    <div className="mx-auto max-w-3xl px-2 py-2 md:px-3 md:py-8">
      <Link
        href="/admin/fraud"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rajlo-red hover:underline"
      >
        <Icon name="arrow-right" className="h-3.5 w-3.5 rotate-180" />
        Fraud dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight md:text-3xl">
        {user.name}
      </h1>
      <p className="text-sm text-muted">{user.role}</p>

      {error && (
        <p className="mt-3 rounded-xl border border-rajlo-red/20 bg-primary-soft px-4 py-2.5 text-sm text-rajlo-red">
          {error}
        </p>
      )}

      {/* ── Risk score ── */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
            Risk score
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => act({ action: "recalculate" })}
            className="rounded-full border border-line bg-background px-3 py-1.5 text-xs font-bold hover:bg-surface-2 disabled:opacity-50"
          >
            Recalculate
          </button>
        </div>
        {riskScore ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-4xl font-extrabold tabular-nums">
                {riskScore.score}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  LEVEL_STYLE[riskScore.level] ?? LEVEL_STYLE.low
                }`}
              >
                {riskScore.level}
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {Object.entries(riskScore.breakdown)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => (
                  <li
                    key={k}
                    className="flex justify-between text-xs text-muted"
                  >
                    <span>{k}</span>
                    <span className="font-bold">+{v}</span>
                  </li>
                ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Not scored yet — tap Recalculate.
          </p>
        )}
      </section>

      {/* ── Enforcement ── */}
      <section className="mt-6 rounded-2xl border border-rajlo-red/20 bg-primary-soft/40 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-rajlo-red">
          Enforcement
        </h2>
        <p className="mt-1 text-xs text-muted">
          Actions are recorded in the moderation log. Suspensions and
          bans block the account from signing in.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { action: "warning", label: "Warn" },
            { action: "temporary_suspension", label: "Suspend 30d" },
            { action: "permanent_ban", label: "Permanent ban" },
            { action: "reinstatement", label: "Reinstate" },
            ...(user.role === "driver"
              ? [{ action: "payout_hold", label: "Hold payouts" }]
              : []),
          ].map((b) => (
            <button
              key={b.action}
              type="button"
              disabled={busy}
              onClick={() => {
                const reason =
                  window.prompt(`Reason for "${b.label}"`) ?? "";
                if (
                  b.action !== "reinstatement" &&
                  b.action !== "warning" &&
                  !reason.trim()
                ) {
                  return;
                }
                moderate(b.action, reason);
              }}
              className="rounded-full border border-rajlo-red/30 bg-background px-3 py-1.5 text-xs font-bold text-rajlo-red hover:bg-surface-2 disabled:opacity-50"
            >
              {b.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Flags ── */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
            Fraud flags
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const flagType = window.prompt("Flag type (e.g. gps_spoofing)");
              if (!flagType) return;
              const description = window.prompt("Description");
              if (!description) return;
              const severity =
                window.prompt("Severity: low / medium / high / critical", "medium") ??
                "medium";
              act({ action: "raise_flag", flagType, description, severity });
            }}
            className="rounded-full bg-rajlo-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Raise flag
          </button>
        </div>
        {flags.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            No flags on this account.
          </p>
        ) : (
          <ul className="space-y-2">
            {flags.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-line bg-surface p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-rajlo-red">
                    {f.flag_type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      LEVEL_STYLE[f.severity] ?? LEVEL_STYLE.low
                    }`}
                  >
                    {f.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm">{f.description}</p>
                {f.resolved_at ? (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                    Resolved
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act({ action: "resolve_flag", flagId: f.id })}
                    className="mt-2 rounded-full border border-line bg-background px-3 py-1 text-[11px] font-bold hover:bg-surface-2 disabled:opacity-50"
                  >
                    Mark resolved
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Linked accounts ── */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-muted">
          Linked accounts ({linkedAccounts.length})
        </h2>
        {linkedAccounts.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            No accounts share this user&apos;s device or IP.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {linkedAccounts.map((a) => (
              <li key={a.userId}>
                <Link
                  href={`/admin/fraud/${a.userId}`}
                  className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:border-rajlo-red"
                >
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Investigations ── */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
            Investigations
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const summary = window.prompt("Investigation summary");
              if (!summary) return;
              act({ action: "open_investigation", summary });
            }}
            className="rounded-full bg-rajlo-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Open investigation
          </button>
        </div>
        {investigations.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            No investigations.
          </p>
        ) : (
          <ul className="space-y-2">
            {investigations.map((inv) => (
              <li
                key={inv.id}
                className="rounded-xl border border-line bg-surface p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                    {inv.status}
                  </span>
                </div>
                <p className="mt-1 text-sm">{inv.summary}</p>
                {inv.resolution && (
                  <p className="mt-1 text-xs text-muted">
                    Resolution: {inv.resolution}
                  </p>
                )}
                {inv.status !== "resolved" && inv.status !== "dismissed" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const resolution =
                        window.prompt("Resolution note (optional)") ?? "";
                      act({
                        action: "resolve_investigation",
                        investigationId: inv.id,
                        status: "resolved",
                        resolution,
                      });
                    }}
                    className="mt-2 rounded-full border border-line bg-background px-3 py-1 text-[11px] font-bold hover:bg-surface-2 disabled:opacity-50"
                  >
                    Resolve
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Device fingerprints ── */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-muted">
          Device fingerprints ({fingerprints.length})
        </h2>
        {fingerprints.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            No fingerprints captured yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {fingerprints.map((fp, i) => (
              <li
                key={i}
                className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs"
              >
                <p className="font-mono text-[11px] text-muted">
                  {fp.fingerprint_hash.slice(0, 24)}…
                </p>
                <p className="mt-0.5 text-muted">
                  {fp.device_type ?? "?"} · {fp.os_version ?? "?"} ·{" "}
                  {fp.ip_address ?? "no IP"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
