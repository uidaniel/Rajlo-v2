import { NextRequest, NextResponse } from "next/server";
import { buildComplianceSummary, buildMockCompliancePayload, deriveDocStatus } from "@/lib/compliance-utils";
import { requiredTADocuments, type TADocument } from "@/lib/mock-data";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const driverId = request.nextUrl.searchParams.get("driverId") ?? "DRV-1031";
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(buildMockCompliancePayload(driverId));
  }

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id")
    .eq("external_id", driverId)
    .maybeSingle();

  if (driverError || !driver) {
    return NextResponse.json(buildMockCompliancePayload(driverId));
  }

  const { data: docs, error: docsError } = await supabase
    .from("driver_documents")
    .select("doc_key,label,description,renewal_period_days,expires_on,status,note")
    .eq("driver_id", driver.id);

  if (docsError || !docs || docs.length === 0) {
    return NextResponse.json(buildMockCompliancePayload(driverId));
  }

  const docMap = new Map(docs.map((d) => [d.doc_key, d]));
  const mergedDocs: TADocument[] = requiredTADocuments.map((templateDoc) => {
    const dbDoc = docMap.get(templateDoc.id);
    if (!dbDoc) return templateDoc;

    const status = deriveDocStatus(dbDoc.status, dbDoc.expires_on ?? undefined);
    return {
      ...templateDoc,
      label: dbDoc.label ?? templateDoc.label,
      description: dbDoc.description ?? templateDoc.description,
      renewalPeriodDays: dbDoc.renewal_period_days ?? templateDoc.renewalPeriodDays,
      expiryDate: dbDoc.expires_on ?? undefined,
      note: dbDoc.note ?? undefined,
      status,
    };
  });

  return NextResponse.json({
    driverId,
    docs: mergedDocs,
    summary: buildComplianceSummary(mergedDocs),
    source: "supabase",
  });
}
