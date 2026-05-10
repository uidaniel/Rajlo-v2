import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/drivers
 *
 * Driver-focused list for the admin's Drivers page. Joins drivers +
 * profiles + driver_documents so the table can show plate, activation
 * status, document review state, and a `needsReview` flag for any
 * driver who has re-uploaded a previously-approved doc (e.g. a renewal
 * after expiry).
 *
 * Query:
 *   ?status=approved|pending_review|rejected|deactivated|needs_review|all
 *   ?q=<name | external_id | plate>
 *   ?limit=200 (max 500)
 */

type DriverRow = {
  id: string;
  externalId: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  plateNumber: string | null;
  vehicle: string | null;
  parishOrRegion: string | null;
  onboardingStatus: string;
  activated: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  submittedAt: string | null;
  /** True when at least one doc was previously approved and is now
   *  pending again — i.e. the driver re-uploaded a renewal that the
   *  admin hasn't re-approved yet. */
  needsReview: boolean;
  /** Counts for the table summary chips. */
  docCounts: {
    approved: number;
    pending: number;
    rejected: number;
    missing: number;
  };
};

export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") ?? 200)),
  );

  let query = supabase
    .from("drivers")
    .select(
      "id, user_id, external_id, first_name, last_name, email, phone, plate_number, vehicle_make, vehicle_model, vehicle_color, onboarding_status, activated, deactivated_at, created_at, submitted_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "approved") {
    query = query.eq("onboarding_status", "approved").eq("activated", true);
  } else if (status === "pending_review") {
    query = query.eq("onboarding_status", "pending_review");
  } else if (status === "rejected") {
    query = query.eq("onboarding_status", "rejected");
  } else if (status === "deactivated") {
    query = query.eq("activated", false).not("deactivated_at", "is", null);
  }
  // `needs_review` is a derived filter applied after we hydrate doc counts.

  if (q) {
    const safe = q.replace(/[,()]/g, "");
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,external_id.ilike.%${safe}%,plate_number.ilike.%${safe}%`,
    );
  }

  const { data: drivers, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!drivers || drivers.length === 0) {
    return NextResponse.json({ drivers: [], total: 0 });
  }

  // Bulk-fetch documents for ALL drivers in this page in one query.
  const driverIds = drivers.map((d) => d.id);
  const { data: docs } = await supabase
    .from("driver_documents")
    .select("driver_id, status, previously_approved")
    .in("driver_id", driverIds);

  const docCountsByDriver = new Map<
    string,
    { approved: number; pending: number; rejected: number; missing: number; needsReview: boolean }
  >();
  for (const d of drivers) {
    docCountsByDriver.set(d.id, {
      approved: 0,
      pending: 0,
      rejected: 0,
      missing: 0,
      needsReview: false,
    });
  }
  for (const doc of docs ?? []) {
    const cur = docCountsByDriver.get(doc.driver_id);
    if (!cur) continue;
    if (doc.status === "approved") cur.approved++;
    else if (doc.status === "pending") cur.pending++;
    else if (doc.status === "rejected") cur.rejected++;
    else if (doc.status === "missing") cur.missing++;
    // Re-uploaded after a previous approval = needs admin re-review.
    if (doc.previously_approved && doc.status === "pending") {
      cur.needsReview = true;
    }
  }

  // Optional needs_review filter — applied here because it depends on
  // the joined doc data.
  let rows: DriverRow[] = drivers.map((d) => {
    const counts = docCountsByDriver.get(d.id) ?? {
      approved: 0,
      pending: 0,
      rejected: 0,
      missing: 0,
      needsReview: false,
    };
    return {
      id: d.id,
      externalId: d.external_id,
      userId: d.user_id,
      fullName:
        [d.first_name, d.last_name].filter(Boolean).join(" ") ||
        "Unnamed driver",
      email: d.email,
      phone: d.phone,
      plateNumber: d.plate_number,
      vehicle:
        [d.vehicle_color, d.vehicle_make, d.vehicle_model]
          .filter(Boolean)
          .join(" ") || null,
      parishOrRegion: null,
      onboardingStatus: d.onboarding_status,
      activated: d.activated,
      deactivatedAt: d.deactivated_at,
      createdAt: d.created_at,
      submittedAt: d.submitted_at,
      needsReview: counts.needsReview,
      docCounts: {
        approved: counts.approved,
        pending: counts.pending,
        rejected: counts.rejected,
        missing: counts.missing,
      },
    };
  });

  if (status === "needs_review") {
    rows = rows.filter((r) => r.needsReview);
  }

  return NextResponse.json({ drivers: rows, total: rows.length });
}
