"use client";
import { useEffect, useMemo, useState } from "react";
import { type TADocument } from "@/lib/mock-data";
import { buildMockCompliancePayload } from "@/lib/compliance-utils";

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusLabel(doc: TADocument): { text: string; color: string; bg: string; icon: string } {
  const days = daysUntil(doc.expiryDate);
  if (doc.status === "expired" || (days !== null && days < 0)) {
    return { text: "Expired", color: "#c0392b", bg: "#fdecea", icon: "🔴" };
  }
  if (doc.status === "expiring_soon" || (days !== null && days <= 30)) {
    return { text: days !== null ? `Expires in ${days}d` : "Expiring soon", color: "#b45309", bg: "#fef7e0", icon: "⚠️" };
  }
  if (doc.status === "pending") {
    return { text: "Pending Review", color: "#1e6f5c", bg: "#d8ede7", icon: "🔄" };
  }
  if (doc.status === "rejected") {
    return { text: "Rejected", color: "#c0392b", bg: "#fdecea", icon: "❌" };
  }
  if (doc.status === "missing") {
    return { text: "Missing", color: "#c0392b", bg: "#fdecea", icon: "📋" };
  }
  if (days !== null && days <= 60) {
    return { text: `Renew in ${days}d`, color: "#b45309", bg: "#fef7e0", icon: "⏰" };
  }
  return { text: "Approved", color: "#1e6f5c", bg: "#d8ede7", icon: "✅" };
}

function renewalLabel(doc: TADocument): string {
  if (doc.renewalPeriodDays === 0) return "Permanent";
  if (doc.renewalPeriodDays === 365) return "Annual";
  if (doc.renewalPeriodDays === 730) return "Every 2 years";
  if (doc.renewalPeriodDays >= 1825) return "Every 5 years";
  return `Every ${doc.renewalPeriodDays} days`;
}

export default function DriverVerificationPage() {
  const [driverId] = useState("DRV-1031");
  const [docs, setDocs] = useState<TADocument[]>([]);
  const [selected, setSelected] = useState<TADocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCompliance() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/driver/compliance?driverId=${driverId}`);
        if (!response.ok) {
          throw new Error("Failed to load compliance data");
        }
        const payload = (await response.json()) as { docs: TADocument[] };
        if (mounted) {
          setDocs(payload.docs ?? buildMockCompliancePayload(driverId).docs);
        }
      } catch {
        if (mounted) {
          setDocs(buildMockCompliancePayload(driverId).docs);
          setLoadError("Showing fallback data. Connect Supabase to load live records.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCompliance();

    return () => {
      mounted = false;
    };
  }, [driverId]);

  const expiredOrMissing = useMemo(() => docs.filter((d) => {
    const days = daysUntil(d.expiryDate);
    return d.status === "expired" || d.status === "missing" || (days !== null && days < 0);
  }), [docs]);

  const expiringSoon = useMemo(() => docs.filter((d) => {
    const days = daysUntil(d.expiryDate);
    return (days !== null && days >= 0 && days <= 60) || d.status === "expiring_soon";
  }), [docs]);

  const allGood = expiredOrMissing.length === 0 && expiringSoon.length === 0;

  return (
    <div className="min-h-screen pb-12" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>TA Compliance Status</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            All 10 Jamaica Transport Authority required documents
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
            Loading compliance records...
          </div>
        )}

        {/* Summary banner */}
        {!loading && !allGood && (
          <div
            className="rounded-2xl px-4 py-3 border"
            style={{
              background: expiredOrMissing.length > 0 ? "#fdecea" : "#fef7e0",
              borderColor: expiredOrMissing.length > 0 ? "#c0392b" : "#b45309",
            }}
          >
            <p
              className="text-sm font-semibold"
              style={{ color: expiredOrMissing.length > 0 ? "#c0392b" : "#b45309" }}
            >
              {expiredOrMissing.length > 0
                ? `${expiredOrMissing.length} document${expiredOrMissing.length > 1 ? "s" : ""} expired or missing — account may be suspended`
                : `${expiringSoon.length} document${expiringSoon.length > 1 ? "s" : ""} expiring within 60 days — renew soon`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: expiredOrMissing.length > 0 ? "#c0392b" : "#92660c" }}>
              Contact the Jamaica Transport Authority at 876-926-9937 or visit transportauthority.gov.jm
            </p>
          </div>
        )}
        {!loading && allGood && (
          <div
            className="rounded-2xl px-4 py-3 border"
            style={{ background: "var(--primary-soft)", borderColor: "var(--primary)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
              ✅ All documents are current — you&apos;re fully compliant
            </p>
          </div>
        )}

        {/* Document cards */}
        <div className="space-y-2">
          {docs.map((doc) => {
            const s = statusLabel(doc);
            const days = daysUntil(doc.expiryDate);
            return (
              <button
                key={doc.id}
                onClick={() => setSelected(selected?.id === doc.id ? null : doc)}
                className="w-full text-left rounded-2xl border p-4 transition-all"
                style={{
                  background: "var(--surface)",
                  borderColor: selected?.id === doc.id ? "var(--primary)" : "var(--line)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                      {s.icon} {doc.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {renewalLabel(doc)}
                      {doc.expiryDate && ` • Expires ${doc.expiryDate}`}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {s.text}
                  </span>
                </div>

                {/* Expanded detail */}
                {selected?.id === doc.id && (
                  <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: "var(--line)" }}>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{doc.description}</p>
                    {doc.note && (
                      <p className="text-xs font-medium" style={{ color: s.color }}>
                        {doc.note}
                      </p>
                    )}
                    {days !== null && days > 0 && days <= 60 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                          <span>Renewal urgency</span>
                          <span>{days} days left</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: "var(--line)" }}>
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, (days / 60) * 100))}%`,
                              background: days <= 7 ? "#c0392b" : days <= 30 ? "#b45309" : "#1e6f5c",
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <a
                      href="/driver/documents"
                      className="inline-block mt-1 rounded-full px-4 py-1.5 text-xs font-semibold text-white"
                      style={{ background: "var(--primary)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Update Document
                    </a>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* TA contact footer */}
        <div
          className="rounded-2xl border px-4 py-4 text-sm space-y-1"
          style={{ background: "var(--surface-soft)", borderColor: "var(--line)" }}
        >
          <p className="font-semibold" style={{ color: "var(--foreground)" }}>Jamaica Transport Authority</p>
          <p style={{ color: "var(--muted)" }}>📞 876-926-9937</p>
          <p style={{ color: "var(--muted)" }}>🌐 transportauthority.gov.jm</p>
          <p className="text-xs pt-1" style={{ color: "var(--muted)" }}>
            Contact the TA directly to renew your Franchise Certificate, COF, or Driver Badge.
            Fees and schedules are set annually by the TA — verify current amounts before visiting.
          </p>
        </div>
      </div>
    </div>
  );
}
