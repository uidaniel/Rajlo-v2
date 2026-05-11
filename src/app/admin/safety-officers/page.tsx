"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { useLiveQuery } from "@/lib/use-live-query";

/**
 * Admin-only officer management.
 *
 * The page lists current safety officers and lets the admin promote
 * a rider account to safety_officer or demote one back to rider. Driver
 * accounts can't be promoted (they need a separate non-driving account
 * so RLS scope stays clean), and admin accounts can't be changed from
 * here (force the admin to go through a separate, more deliberate
 * surface for admin role changes — out of scope for this page).
 */

type OfficerRow = {
  id: string;
  name: string;
  email: string | null;
  promotedAt: string;
};

type Candidate = {
  id: string;
  name: string;
  role: string;
};

export default function AdminSafetyOfficersPage() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const query = useLiveQuery<{ officers: OfficerRow[]; candidates: Candidate[] }>(
    `/api/admin/safety-officers${q.length >= 2 ? `?q=${encodeURIComponent(q)}` : ""}`,
    { interval: 0 },
  );

  const officers = query.data?.officers ?? [];
  const candidates = query.data?.candidates ?? [];

  const setRole = async (
    userId: string,
    role: "safety_officer" | "rider",
  ) => {
    setBusy(userId);
    try {
      await fetch("/api/admin/safety-officers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      query.refresh?.();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-2 py-2 md:px-3 md:py-8">
      {/* Hero */}
      <div className="rounded-3xl border border-line bg-surface p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-rajlo-red">
          Safety operations
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
          Safety officers
        </h1>
        <p className="mt-1 text-sm text-muted">
          Officers see the safety queue, chat with riders during incidents, and
          watch live trips. They cannot manage wallets, drivers, or any other
          admin surface.
        </p>
      </div>

      {/* Current officers */}
      <section className="rounded-3xl border border-line bg-surface p-5 md:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Current officers ({officers.length})
        </h2>
        <div className="mt-3 space-y-2">
          {query.loading && officers.length === 0 ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : officers.length === 0 ? (
            <p className="text-sm text-muted">
              No safety officers yet. Promote someone below to get started.
            </p>
          ) : (
            officers.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-soft px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{o.name}</p>
                  {o.email && (
                    <p className="truncate text-[11px] text-muted">{o.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setRole(o.id, "rider")}
                  disabled={busy === o.id}
                  className="shrink-0 rounded-full bg-rajlo-red px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rajlo-red/90 disabled:opacity-50"
                >
                  {busy === o.id ? "Removing…" : "Remove role"}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Promote */}
      <section className="rounded-3xl border border-line bg-surface p-5 md:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
          Promote rider to officer
        </h2>
        <p className="mt-1 text-xs text-muted">
          Type at least 2 characters of the person&apos;s name. Only rider
          accounts can be promoted — driver and admin accounts are excluded.
        </p>
        <div className="mt-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-2.5 text-sm outline-none focus:border-rajlo-red"
          />
        </div>
        {q.length >= 2 && (
          <div className="mt-3 space-y-2">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted">No matches.</p>
            ) : (
              candidates.map((c) => {
                const canPromote = c.role === "rider";
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-soft px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="text-[11px] uppercase tracking-wider text-muted">
                        {c.role}
                      </p>
                    </div>
                    {c.role === "safety_officer" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                        <Icon name="check-circle" className="h-3 w-3" />
                        Already an officer
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRole(c.id, "safety_officer")}
                        disabled={busy === c.id || !canPromote}
                        className="shrink-0 rounded-full bg-rajlo-red px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rajlo-red/90 disabled:opacity-50"
                        title={
                          canPromote
                            ? undefined
                            : "Only rider accounts can be promoted"
                        }
                      >
                        {busy === c.id ? "Promoting…" : "Promote"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}
