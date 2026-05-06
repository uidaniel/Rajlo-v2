import { complianceThresholds, requiredTADocuments, type DocStatus, type TADocument } from "@/lib/mock-data";

export type DriverComplianceSummary = {
  expired: number;
  urgent: number;
  upcoming: number;
};

export type DriverCompliancePayload = {
  driverId: string;
  docs: TADocument[];
  summary: DriverComplianceSummary;
  source: "supabase" | "mock";
};

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function deriveDocStatus(status: DocStatus, expiryDate?: string): DocStatus {
  const days = daysUntil(expiryDate);
  if (status === "missing" || status === "rejected" || status === "pending") return status;
  if (days === null) return status;
  if (days < 0) return "expired";
  if (days <= complianceThresholds.urgentDays) return "expiring_soon";
  return "approved";
}

export function buildComplianceSummary(docs: TADocument[]): DriverComplianceSummary {
  let expired = 0;
  let urgent = 0;
  let upcoming = 0;

  for (const doc of docs) {
    const days = daysUntil(doc.expiryDate);
    const status = deriveDocStatus(doc.status, doc.expiryDate);

    if (status === "expired" || status === "missing") {
      expired += 1;
      continue;
    }

    if (days !== null && days >= 0 && days <= complianceThresholds.urgentDays) {
      urgent += 1;
      continue;
    }

    if (
      days !== null &&
      days > complianceThresholds.urgentDays &&
      days <= complianceThresholds.warningDays
    ) {
      upcoming += 1;
    }
  }

  return { expired, urgent, upcoming };
}

export function buildMockCompliancePayload(driverId = "DRV-1031"): DriverCompliancePayload {
  return {
    driverId,
    docs: requiredTADocuments,
    summary: buildComplianceSummary(requiredTADocuments),
    source: "mock",
  };
}
