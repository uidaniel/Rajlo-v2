"use client";

import { useEffect, useMemo, useState } from "react";
import { requiredTADocuments } from "@/lib/mock-data";

type ReviewState = "approved" | "pending" | "rejected" | "resubmit";

type ReviewedDoc = {
  id: string;
  label: string;
  description: string;
  status: ReviewState;
  note: string;
};

export default function AdminVerificationDetailPage() {
  const [driverId] = useState("DRV-1031");
  const [docs, setDocs] = useState<ReviewedDoc[]>(
    requiredTADocuments.map((doc) => ({
      id: doc.id,
      label: doc.label,
      description: doc.description,
      status: doc.status === "approved" ? "approved" : doc.status === "pending" ? "pending" : "resubmit",
      note: doc.note ?? "",
    }))
  );

  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<string[]>([
    "2026-03-24 09:12 • Application submitted by DRV-1031",
    "2026-03-24 09:28 • Auto checks completed (TRN/NIS format valid)",
  ]);

  useEffect(() => {
    let mounted = true;
    const fallbackDocs = docs;
    const fallbackAudit = auditTrail;

    async function loadVerification() {
      setLoading(true);
      setStatusMessage(null);
      try {
        const response = await fetch(`/api/admin/verification?driverId=${driverId}`);
        if (!response.ok) {
          throw new Error("Failed to load verification details");
        }
        const payload = (await response.json()) as {
          docs: ReviewedDoc[];
          auditTrail: string[];
          source: "supabase" | "mock";
        };

        if (mounted) {
          setDocs(payload.docs.length > 0 ? payload.docs : fallbackDocs);
          setAuditTrail(payload.auditTrail.length > 0 ? payload.auditTrail : fallbackAudit);
          if (payload.source === "mock") {
            setStatusMessage("Using mock data. Configure Supabase env vars for live admin reviews.");
          }
        }
      } catch {
        if (mounted) {
          setStatusMessage("Could not load live verification details. Showing local state.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadVerification();

    return () => {
      mounted = false;
    };
  }, [driverId]);

  const allApproved = useMemo(() => docs.every((d) => d.status === "approved"), [docs]);

  const updateStatus = (id: string, status: ReviewState) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
    const label = docs.find((d) => d.id === id)?.label ?? id;
    setAuditTrail((prev) => [
      `${new Date().toISOString().slice(0, 16).replace("T", " ")} • ${label} marked ${status.toUpperCase()}`,
      ...prev,
    ]);
  };

  const updateNote = (id: string, note: string) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, note } : d)));
  };

  const submitDecision = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/verification/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driverId,
          adminNote,
          docs,
          activateDriver: allApproved,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit verification decision");
      }

      setAuditTrail((prev) => [
        `${new Date().toISOString().slice(0, 16).replace("T", " ")} • Admin decision submitted: ${
          allApproved ? "APPROVED" : "PENDING CORRECTIONS"
        }`,
        ...prev,
      ]);
      setAdminNote("");
      setStatusMessage("Verification decision saved.");
    } catch {
      setStatusMessage("Failed to save decision. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-12" style={{ background: "var(--background)" }}>
      <div
        className="sticky top-0 z-10 px-4 py-4 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Driver Verification Detail</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Driver ID: {driverId} • Red Plate: 5812 GK</p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: allApproved ? "var(--primary-soft)" : "#fef7e0",
              color: allApproved ? "var(--primary)" : "#b45309",
            }}
          >
            {allApproved ? "Eligible for Activation" : "Pending Document Actions"}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-4 grid lg:grid-cols-[2fr_1fr] gap-4">
        {statusMessage && (
          <div className="lg:col-span-2 rounded-xl border px-4 py-2 text-xs" style={{ borderColor: "#b45309", color: "#92660c", background: "#fef7e0" }}>
            {statusMessage}
          </div>
        )}

        {loading && (
          <div className="lg:col-span-2 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--line)", color: "var(--muted)", background: "var(--surface)" }}>
            Loading verification details...
          </div>
        )}

        <section className="space-y-3">
          {docs.map((doc) => {
            const statusColor =
              doc.status === "approved"
                ? { bg: "#e9f5f1", text: "#1e6f5c" }
                : doc.status === "rejected"
                  ? { bg: "#fdecea", text: "#c0392b" }
                  : doc.status === "resubmit"
                    ? { bg: "#fff1ec", text: "#d9480f" }
                    : { bg: "#f3f4f6", text: "#4b5563" };

            return (
              <div
                key={doc.id}
                className="rounded-2xl border p-4 space-y-3"
                style={{ background: "var(--surface)", borderColor: "var(--line)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{doc.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{doc.description}</p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ background: statusColor.bg, color: statusColor.text }}
                  >
                    {doc.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => updateStatus(doc.id, "approved")}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "#e9f5f1", color: "#1e6f5c" }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateStatus(doc.id, "rejected")}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "#fdecea", color: "#c0392b" }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => updateStatus(doc.id, "resubmit")}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "#fff1ec", color: "#d9480f" }}
                  >
                    Request Resubmission
                  </button>
                  <button
                    onClick={() => updateStatus(doc.id, "pending")}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "#f3f4f6", color: "#4b5563" }}
                  >
                    Mark Pending
                  </button>
                </div>

                <div>
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Document Note</label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                    style={{ borderColor: "var(--line)", background: "var(--surface-soft)", color: "var(--foreground)" }}
                    placeholder="Add reason or guidance for this document decision"
                    value={doc.note}
                    onChange={(e) => updateNote(doc.id, e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </section>

        <aside className="space-y-4">
          <div
            className="rounded-2xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Activation Control</h2>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Driver can only be activated when all 10 TA documents are approved.
            </p>
            <button
              disabled={!allApproved}
              className="mt-3 w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: allApproved ? "var(--primary)" : "#9ca3af" }}
            >
              Activate Driver Account
            </button>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Admin Decision Note</h2>
            <textarea
              rows={4}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface-soft)", color: "var(--foreground)" }}
              placeholder="Summary note sent to driver"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
            <button
              onClick={submitDecision}
              disabled={saving}
              className="mt-3 w-full rounded-full py-2.5 text-sm font-semibold text-white"
              style={{ background: saving ? "#9ca3af" : "var(--primary)" }}
            >
              {saving ? "Saving..." : "Submit Verification Decision"}
            </button>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Audit Trail</h2>
            <div className="mt-2 space-y-2 max-h-64 overflow-auto pr-1">
              {auditTrail.map((entry) => (
                <p key={entry} className="text-xs" style={{ color: "var(--muted)" }}>
                  {entry}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
