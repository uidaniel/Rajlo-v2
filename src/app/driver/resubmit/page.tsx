import { redirect } from "next/navigation";
import { getDriverStatus } from "@/lib/driver-status";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { requiredTADocuments } from "@/lib/mock-data";
import { ResubmitClient, type RejectedDocCard } from "./resubmit-client";

/**
 * Focused resubmission flow. Only shows the docs an admin rejected, so the
 * driver doesn't have to walk through a 7-step wizard just to re-upload one
 * file. Form-data edits live behind /driver/onboarding?edit=1.
 *
 * Server-side gate: only drivers in `rejected` state can land here.
 */
export default async function DriverResubmitPage() {
  const status = await getDriverStatus();

  if (status.state === "unauthenticated") redirect("/auth/driver/login");
  if (status.state === "not_a_driver") redirect("/");
  if (status.state === "needs_onboarding") redirect("/driver/onboarding");
  if (status.state === "active") redirect("/driver");
  if (status.state === "pending_verification") redirect("/driver/pending");
  if (status.state === "deactivated") redirect("/driver/pending");
  // Now: status.state === "rejected"

  const driver = status.driver;

  // Look up which docs are rejected. Service_role client so RLS doesn't hide
  // the rows (consistent with getDriverStatus's approach).
  const admin = getSupabaseServerClient();
  let rejectedDocs: RejectedDocCard[] = [];

  if (admin) {
    const { data: docs } = await admin
      .from("driver_documents")
      .select("doc_key, status, note, expires_on, renewal_period_days")
      .eq("driver_id", driver.id)
      .eq("status", "rejected");

    rejectedDocs = (docs ?? []).map((d) => {
      const meta = requiredTADocuments.find((r) => r.id === d.doc_key);
      return {
        id: d.doc_key,
        label: meta?.label ?? humanizeDocKey(d.doc_key),
        description: meta?.description ?? "",
        adminNote: d.note,
        // Renewal period drives whether the resubmit UI requires a fresh
        // expiry date. Prefer the row value (admin may have set a custom
        // period); fall back to the template constant.
        renewalPeriodDays:
          (d.renewal_period_days ?? meta?.renewalPeriodDays ?? 0) as number,
        currentExpiresOn: (d.expires_on ?? null) as string | null,
      };
    });
  }

  // If somehow no rejected docs exist but the driver is still flagged
  // rejected, send them to the full wizard so they can resubmit cleanly.
  if (rejectedDocs.length === 0) {
    redirect("/driver/onboarding?edit=1");
  }

  return (
    <ResubmitClient
      adminNote={driver.admin_note}
      rejectedDocs={rejectedDocs}
    />
  );
}

function humanizeDocKey(key: string): string {
  const map: Record<string, string> = {
    drivers_licence_front: "Driver's licence (front)",
    drivers_licence_back: "Driver's licence (back)",
    driver_badge: "TA Driver Badge",
    franchise_cert: "TA Franchise Certificate",
    cof: "Certificate of Fitness",
    insurance: "PPV Insurance",
    police_record: "Police Record",
    selfie: "Identity selfie",
    red_plate_reg: "Red plate registration",
  };
  return map[key] ?? key.replace(/_/g, " ");
}
