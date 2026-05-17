"use client";

import Link from "next/link";
import { useState } from "react";
import { Skeleton } from "@/components/skeleton";
import { useLiveQuery } from "@/lib/use-live-query";

/**
 * /admin/incidents — the incident queue.
 *
 * Lists open incidents by default (toggle to show all). Each row links
 * to the full incident dossier. Gated by `view_incidents`.
 */

type Incident = {
  id: string;
  incidentType: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
  title: string;
  reporter: string;
  reporterRole: string | null;
  reportedAt: string;
};

const SEVERITY_STYLE: Record<string, string> = {
  low: "bg-surface-soft text-muted",
  medium: "bg-amber-50 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-primary-soft text-rajlo-red",
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminIncidentsPage() {
  const [scope, setScope] = useState<"open" | "all">("open");
  const query = useLiveQuery<{ incidents: Incident[] }>(
    `/api/admin/incidents?scope=${scope}`,
    { interval: 30_000 },
  );
  const incidents = query.data?.incidents ?? [];

  return (
    <div className="mx-auto max-w-3xl px-2 py-2 md:px-3 md:py-8">
      <div className="mb-5">
        <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
          Safety
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
          Incident queue
        </h1>
        <p className="mt-2 text-sm text-muted">
          Rider and driver incident reports. Critical reports are
          auto-escalated to the top.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {(["open", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize ${
              scope === s
                ? "bg-rajlo-red text-white"
                : "border border-line bg-surface text-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {query.loading ? (
        <Skeleton className="h-64 w-full" rounded="lg" />
      ) : incidents.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          No {scope === "open" ? "open " : ""}incidents.
        </p>
      ) : (
        <ul className="space-y-2">
          {incidents.map((i) => (
            <li key={i.id}>
              <Link
                href={`/admin/incidents/${i.id}`}
                className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-rajlo-red"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-extrabold">{i.title}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      SEVERITY_STYLE[i.severity] ?? SEVERITY_STYLE.low
                    }`}
                  >
                    {i.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {i.incidentType.replace(/_/g, " ")} · {i.status.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {i.reporter}
                  {i.reporterRole ? ` (${i.reporterRole})` : ""} ·{" "}
                  {timeAgo(i.reportedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
