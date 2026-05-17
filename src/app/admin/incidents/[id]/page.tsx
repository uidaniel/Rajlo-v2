"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/skeleton";

/**
 * /admin/incidents/[id] — full incident dossier.
 *
 * Shows the report, its evidence, the support notes, and the immutable
 * audit trail — with the workflow controls to change status, record a
 * resolution, self-assign, and add notes. All mutations go through
 * PATCH /api/admin/incidents/[id].
 */

type Detail = {
  incident: {
    id: string;
    incidentType: string;
    severity: string;
    status: string;
    title: string;
    description: string;
    tripId: string | null;
    reporterName: string;
    reporterRole: string | null;
    reporterUserId: string | null;
    incidentTimestamp: string | null;
    reportedAt: string;
    resolutionSummary: string | null;
    actionTaken: string | null;
  };
  evidence: { id: string; evidence_type: string; file_url: string | null; uploaded_at: string }[];
  notes: {
    id: string;
    admin_label: string | null;
    note_text: string;
    is_internal: boolean;
    created_at: string;
  }[];
  auditLogs: {
    id: string;
    action_type: string;
    action_description: string;
    created_at: string;
  }[];
};

const STATUSES = [
  "open",
  "under_review",
  "awaiting_response",
  "escalated",
  "resolved",
  "closed",
];

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/incidents/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail((await res.json()) as Detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
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

  const { incident, notes, auditLogs, evidence } = detail;

  return (
    <div className="mx-auto max-w-3xl px-2 py-2 md:px-3 md:py-8">
      <Link
        href="/admin/incidents"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rajlo-red hover:underline"
      >
        <Icon name="arrow-right" className="h-3.5 w-3.5 rotate-180" />
        Incident queue
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight md:text-3xl">
        {incident.title}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {incident.incidentType.replace(/_/g, " ")} · {incident.severity} ·
        reported by {incident.reporterName}
        {incident.reporterRole ? ` (${incident.reporterRole})` : ""}
      </p>

      {error && (
        <p className="mt-3 rounded-xl border border-rajlo-red/20 bg-primary-soft px-4 py-2.5 text-sm text-rajlo-red">
          {error}
        </p>
      )}

      {/* ── Report ── */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {incident.description}
        </p>
        {incident.tripId && (
          <p className="mt-3 text-xs text-muted">Trip: {incident.tripId}</p>
        )}
      </section>

      {/* ── Workflow ── */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
          Status
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy || s === incident.status}
              onClick={() => patch({ status: s })}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize disabled:opacity-50 ${
                s === incident.status
                  ? "bg-rajlo-red text-white"
                  : "border border-line bg-background hover:bg-surface-2"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ assignToMe: true })}
            className="rounded-full border border-line bg-background px-3 py-1.5 text-xs font-bold hover:bg-surface-2 disabled:opacity-50"
          >
            Assign to me
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const resolutionSummary =
                window.prompt("Resolution summary") ?? "";
              if (!resolutionSummary.trim()) return;
              const actionTaken =
                window.prompt("Action taken (optional)") ?? "";
              patch({ status: "resolved", resolutionSummary, actionTaken });
            }}
            className="rounded-full bg-rajlo-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Resolve with summary
          </button>
        </div>
        {incident.resolutionSummary && (
          <p className="mt-3 rounded-xl bg-background p-3 text-xs text-muted">
            <strong>Resolution:</strong> {incident.resolutionSummary}
            {incident.actionTaken ? ` — ${incident.actionTaken}` : ""}
          </p>
        )}
      </section>

      {/* ── Support notes ── */}
      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
            Support notes
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const note = window.prompt("Add a support note");
              if (!note?.trim()) return;
              patch({ note });
            }}
            className="rounded-full bg-rajlo-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Add note
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            No notes yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-line bg-surface p-3.5"
              >
                <p className="text-sm">{n.note_text}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {n.admin_label ?? "Admin"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Evidence ── */}
      {evidence.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-muted">
            Evidence ({evidence.length})
          </h2>
          <ul className="space-y-1.5">
            {evidence.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs"
              >
                {e.evidence_type}
                {e.file_url && (
                  <a
                    href={e.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 font-bold text-rajlo-red hover:underline"
                  >
                    View
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Audit trail ── */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-muted">
          Audit trail
        </h2>
        <ul className="space-y-1.5">
          {auditLogs.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-muted"
            >
              {a.action_description}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
