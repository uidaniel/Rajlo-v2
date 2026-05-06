import { NextRequest, NextResponse } from "next/server";
import { requiredTADocuments } from "@/lib/mock-data";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const driverId = request.nextUrl.searchParams.get("driverId") ?? "DRV-1031";
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      source: "mock",
      driverId,
      docs: requiredTADocuments.map((doc) => ({
        id: doc.id,
        label: doc.label,
        description: doc.description,
        status: doc.status === "approved" ? "approved" : doc.status === "pending" ? "pending" : "resubmit",
        note: doc.note ?? "",
      })),
      auditTrail: [
        "2026-03-24 09:12 | Application submitted by DRV-1031",
        "2026-03-24 09:28 | Auto checks completed (TRN/NIS format valid)",
      ],
    });
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("id,external_id")
    .eq("external_id", driverId)
    .maybeSingle();

  if (!driver) {
    return NextResponse.json({
      source: "mock",
      driverId,
      docs: requiredTADocuments.map((doc) => ({
        id: doc.id,
        label: doc.label,
        description: doc.description,
        status: "pending",
        note: "",
      })),
      auditTrail: ["No Supabase driver record found; using template docs."],
    });
  }

  const { data: docs } = await supabase
    .from("driver_documents")
    .select("doc_key,label,description,status,note")
    .eq("driver_id", driver.id)
    .order("doc_key", { ascending: true });

  const { data: audit } = await supabase
    .from("driver_audit_logs")
    .select("event,created_at")
    .eq("driver_id", driver.id)
    .order("created_at", { ascending: false })
    .limit(40);

  return NextResponse.json({
    source: "supabase",
    driverId,
    docs:
      docs?.map((doc) => ({
        id: doc.doc_key,
        label: doc.label,
        description: doc.description,
        status: doc.status === "approved" || doc.status === "pending" || doc.status === "rejected" ? doc.status : "resubmit",
        note: doc.note ?? "",
      })) ?? [],
    auditTrail:
      audit?.map((row) => {
        const timestamp = (row.created_at ?? "").replace("T", " ").slice(0, 16);
        return `${timestamp} | ${row.event}`;
      }) ?? [],
  });
}
