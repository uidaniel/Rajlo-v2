import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { requiredTADocuments } from "@/lib/mock-data";
import { RenewClient, type CurrentDocState } from "./renew-client";

/**
 * Single-document renewal / upload screen.
 *
 * Unlike `/driver/resubmit` (which only services the post-rejection
 * flow), this page works for ANY signed-in driver — active drivers
 * with an expiring doc, drivers whose doc was rejected, or drivers
 * who never uploaded the doc at all. The TA verification page links
 * here with the specific `docKey` the driver clicked on.
 *
 * Server-side gates:
 *   - Auth required (redirect to driver login)
 *   - Must be a driver (not just a profile.role check — the drivers
 *     row must exist so we have a driver_id to attach the upload to)
 *   - docKey must be one of the canonical requiredTADocuments ids
 *
 * Active drivers stay active during admin re-review — see the
 * /api/driver/documents/[docKey]/replace route for the rationale.
 */

export default async function DriverRenewDocumentPage({
  params,
}: {
  params: Promise<{ docKey: string }>;
}) {
  const { docKey } = await params;

  const docMeta = requiredTADocuments.find((d) => d.id === docKey);
  if (!docMeta) notFound();

  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) redirect("/auth/driver/login");

  const admin = getSupabaseServerClient();
  if (!admin) {
    // Service role isn't configured — bounce them somewhere sane
    // rather than rendering a half-broken form.
    redirect("/driver");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "driver") redirect("/");

  const { data: driver } = await admin
    .from("drivers")
    .select("id, external_id, onboarding_status, activated, deactivated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) redirect("/driver/onboarding");

  const { data: existing } = await admin
    .from("driver_documents")
    .select("status, note, expires_on, file_name, file_path, previously_approved")
    .eq("driver_id", driver.id)
    .eq("doc_key", docKey)
    .maybeSingle();

  const current: CurrentDocState = existing
    ? {
        status: existing.status,
        adminNote: existing.note ?? null,
        expiresOn: existing.expires_on ?? null,
        fileName: existing.file_name ?? null,
        previouslyApproved: existing.previously_approved === true,
      }
    : {
        status: "missing",
        adminNote: null,
        expiresOn: null,
        fileName: null,
        previouslyApproved: false,
      };

  return (
    <RenewClient
      docKey={docKey}
      docLabel={docMeta.label}
      docDescription={docMeta.description}
      renewalPeriodDays={docMeta.renewalPeriodDays}
      driverActive={driver.activated === true && !driver.deactivated_at}
      current={current}
    />
  );
}
