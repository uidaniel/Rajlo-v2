import { NextRequest, NextResponse } from "next/server";
import {
  buildComplianceSummary,
  buildMockCompliancePayload,
  deriveDocStatus,
} from "@/lib/compliance-utils";
import { requiredTADocuments, type TADocument } from "@/lib/mock-data";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/driver/compliance
 *
 * Two modes:
 *   - `?driverId=DRV-XXX`  → admin lookup by external_id (stays as-is
 *                             so the admin verification queue keeps working)
 *   - no params            → returns the SIGNED-IN driver's docs.
 *                             This is what every driver-portal surface
 *                             should hit so each driver gets THEIR own
 *                             compliance state, not whatever DRV-1031
 *                             happens to be.
 *
 * Falls back to the mock payload only if Supabase isn't configured —
 * in production this means the response is always real per-driver data.
 */
export async function GET(request: NextRequest) {
  const driverIdParam = request.nextUrl.searchParams.get("driverId");
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      buildMockCompliancePayload(driverIdParam ?? "DRV-PREVIEW"),
    );
  }

  // Resolve the target driver row.
  let driverRowId: string | null = null;
  let externalId = driverIdParam ?? "";

  if (driverIdParam) {
    // Admin path — look up by external_id.
    const { data: driver } = await supabase
      .from("drivers")
      .select("id, external_id")
      .eq("external_id", driverIdParam)
      .maybeSingle();
    if (driver) {
      driverRowId = driver.id;
      externalId = driver.external_id;
    }
  } else {
    // Self path — look up by signed-in user.
    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { data: driver } = await supabase
      .from("drivers")
      .select("id, external_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (driver) {
      driverRowId = driver.id;
      externalId = driver.external_id;
    }
  }

  if (!driverRowId) {
    return NextResponse.json(
      { error: "Driver record not found" },
      { status: 404 },
    );
  }

  const { data: docs, error: docsError } = await supabase
    .from("driver_documents")
    .select(
      "doc_key, label, description, renewal_period_days, expires_on, status, note",
    )
    .eq("driver_id", driverRowId);

  // Empty docs row set is legitimate (driver onboarded but admin
  // hasn't created any docs yet). Return the requiredTADocuments as
  // the canonical "what you owe us" list with status 'missing'.
  if (docsError) {
    return NextResponse.json({ error: docsError.message }, { status: 500 });
  }

  const docMap = new Map((docs ?? []).map((d) => [d.doc_key, d]));
  const mergedDocs: TADocument[] = requiredTADocuments.map((templateDoc) => {
    const dbDoc = docMap.get(templateDoc.id);
    if (!dbDoc) {
      // Template-only — render as missing so the UI shows it as a
      // gap to fill.
      return { ...templateDoc, status: "missing" };
    }
    const status = deriveDocStatus(dbDoc.status, dbDoc.expires_on ?? undefined);
    return {
      ...templateDoc,
      label: dbDoc.label ?? templateDoc.label,
      description: dbDoc.description ?? templateDoc.description,
      renewalPeriodDays:
        dbDoc.renewal_period_days ?? templateDoc.renewalPeriodDays,
      expiryDate: dbDoc.expires_on ?? undefined,
      note: dbDoc.note ?? undefined,
      status,
    };
  });

  return NextResponse.json({
    driverId: externalId,
    docs: mergedDocs,
    summary: buildComplianceSummary(mergedDocs),
    source: "supabase",
  });
}
