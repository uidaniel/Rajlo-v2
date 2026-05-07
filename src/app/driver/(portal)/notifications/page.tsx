"use client";

import { useEffect, useState } from "react";
import { complianceThresholds, type TADocument } from "@/lib/mock-data";
import { buildMockCompliancePayload } from "@/lib/compliance-utils";

type ReminderLevel = "info" | "warning" | "urgent" | "expired";

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getLevel(days: number | null): ReminderLevel | null {
  if (days === null) return null;
  if (days < 0) return "expired";
  if (days <= complianceThresholds.criticalDays) return "urgent";
  if (days <= complianceThresholds.urgentDays) return "warning";
  if (days <= complianceThresholds.warningDays) return "info";
  return null;
}

function levelStyle(level: ReminderLevel) {
  if (level === "expired") {
    return { bg: "#fdecea", border: "#c0392b", text: "#c0392b", label: "Expired" };
  }
  if (level === "urgent") {
    return { bg: "#fff1ec", border: "#d9480f", text: "#d9480f", label: "Urgent (<= 7 days)" };
  }
  if (level === "warning") {
    return { bg: "#fef7e0", border: "#b45309", text: "#b45309", label: "Warning (<= 30 days)" };
  }
  return { bg: "#e9f5f1", border: "#1e6f5c", text: "#1e6f5c", label: "Upcoming (<= 60 days)" };
}

export default function DriverNotificationsPage() {
  const [docs, setDocs] = useState<TADocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCompliance() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/driver/compliance?driverId=DRV-1031");
        if (!response.ok) {
          throw new Error("Failed to load compliance data");
        }
        const payload = (await response.json()) as { docs: TADocument[] };
        if (mounted) setDocs(payload.docs ?? buildMockCompliancePayload("DRV-1031").docs);
      } catch {
        if (mounted) {
          setDocs(buildMockCompliancePayload("DRV-1031").docs);
          setLoadError("Showing fallback reminder data. Connect Supabase for live renewals.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCompliance();

    return () => {
      mounted = false;
    };
  }, []);

  const reminders = docs
    .map((doc) => {
      const days = daysUntil(doc.expiryDate);
      const level = getLevel(days);
      return { doc, days, level };
    })
    .filter((entry) => entry.level !== null)
    .sort((a, b) => {
      const ad = a.days ?? 99999;
      const bd = b.days ?? 99999;
      return ad - bd;
    });

  const expiredCount = reminders.filter((r) => r.level === "expired").length;
  const urgentCount = reminders.filter((r) => r.level === "urgent").length;

  return (
    <div className="min-h-screen pb-12" style={{ background: "var(--background)" }}>
      <div
        className="sticky top-0 z-10 px-4 py-4 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Renewal Reminders</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            TA document countdown alerts: {complianceThresholds.warningDays}/{complianceThresholds.urgentDays}/{complianceThresholds.criticalDays}/expired
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {loadError && (
          <div className="rounded-xl border px-4 py-2 text-xs" style={{ borderColor: "#b45309", color: "#92660c", background: "#fef7e0" }}>
            {loadError}
          </div>
        )}

        {loading && (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--muted)" }}>
            Loading renewal reminders...
          </div>
        )}

        {(expiredCount > 0 || urgentCount > 0) && (
          <div
            className="rounded-2xl border px-4 py-3"
            style={{
              background: expiredCount > 0 ? "#fdecea" : "#fff1ec",
              borderColor: expiredCount > 0 ? "#c0392b" : "#d9480f",
            }}
          >
            <p
              className="text-sm font-semibold"
              style={{ color: expiredCount > 0 ? "#c0392b" : "#d9480f" }}
            >
              {expiredCount > 0
                ? `${expiredCount} document(s) expired. Driver account may be suspended until updated.`
                : `${urgentCount} document(s) expiring within 7 days.`}
            </p>
          </div>
        )}

        {reminders.length === 0 && (
          <div
            className="rounded-2xl border px-4 py-3"
            style={{ background: "var(--primary-soft)", borderColor: "var(--primary)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
              No renewals due in the next {complianceThresholds.warningDays} days.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {reminders.map(({ doc, days, level }) => {
            const style = levelStyle(level as ReminderLevel);
            return (
              <div
                key={doc.id}
                className="rounded-2xl border p-4"
                style={{ background: style.bg, borderColor: style.border }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{doc.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{doc.description}</p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
                    style={{ color: style.text, border: `1px solid ${style.border}` }}
                  >
                    {style.label}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs" style={{ color: style.text }}>
                  <span>
                    {days !== null && days >= 0
                      ? `${days} day(s) remaining`
                      : "Already expired"}
                  </span>
                  <span>{doc.expiryDate ? `Expiry: ${doc.expiryDate}` : "No expiry"}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <a
                    href="/driver/documents"
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ background: "var(--primary)" }}
                  >
                    Upload Renewal
                  </a>
                  <a
                    href="/driver/verification"
                    className="rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--foreground)" }}
                  >
                    Open Compliance
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
