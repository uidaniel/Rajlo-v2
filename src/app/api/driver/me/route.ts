import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/driver/me
 *
 * Returns the signed-in driver's full record + all uploaded documents.
 * Used by the onboarding page to pre-fill form fields and pre-mark uploaded
 * docs when a rejected driver resubmits.
 *
 * Uses service_role for the lookup (cookies provide identity). Filtered
 * strictly by the verified user.id.
 */
export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseServerClient();
  if (!admin) {
    return NextResponse.json({ driver: null, documents: [] });
  }

  const { data: driver } = await admin
    .from("drivers")
    .select(
      "id, external_id, user_id, first_name, last_name, phone, email, trn, nis, licence_number, licence_expiry, badge_number, plate_number, vehicle_make, vehicle_model, vehicle_year, franchise_number, franchise_expiry, onboarding_status, activated, admin_note, created_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!driver) {
    return NextResponse.json({ driver: null, documents: [] });
  }

  const { data: docs } = await admin
    .from("driver_documents")
    .select("doc_key, status, file_name, file_path, note")
    .eq("driver_id", driver.id);

  return NextResponse.json({
    driver,
    documents: docs ?? [],
  });
}
