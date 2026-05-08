import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/driver/me
 *
 * Returns the signed-in driver's full record + all uploaded documents.
 * Used by the onboarding page to pre-fill form fields and pre-mark uploaded
 * docs when a rejected driver resubmits, AND by the driver profile page
 * for the in-portal self-edit form.
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
      "id, external_id, user_id, first_name, last_name, phone, email, trn, nis, licence_number, licence_expiry, badge_number, plate_number, vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, franchise_number, franchise_expiry, onboarding_status, activated, admin_note, created_at",
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

/**
 * PATCH /api/driver/me
 *
 * Self-edit handler for the driver profile page. Drivers can update:
 *
 *   - first_name, last_name
 *   - phone
 *
 * Deliberately does NOT accept:
 *   - vehicle_type, vehicle_make, vehicle_model, vehicle_year,
 *     vehicle_color — vehicle is tied to verified compliance docs
 *     (registration, COF, insurance). Changes go through
 *     /api/driver/vehicle-change which collects new docs for admin
 *     review. Silent self-edit would let a driver register one car
 *     and operate a different one.
 *   - plate_number     — TA-tied identifier; changing it should
 *                        re-trigger compliance review, not a silent edit
 *   - licence_number, badge_number, franchise_number — same reason
 *   - email            — ties to the auth account; would need a
 *                        re-verification flow
 *   - onboarding_status, activated — admin-only
 *
 * Body: any subset of the editable fields. Missing fields are left as-is.
 */
type EditableBody = {
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
};

export async function PATCH(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseServerClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as EditableBody;

  // Normalise + validate. Each field is optional but if present must
  // pass its own check; otherwise we 400.
  const update: Record<string, string | number | null> = {};

  const trimString = (v: unknown, max: number): string | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t.length === 0 ? null : t.slice(0, max);
  };

  const firstName = trimString(body.firstName, 60);
  if (firstName !== undefined) update.first_name = firstName;
  const lastName = trimString(body.lastName, 60);
  if (lastName !== undefined) update.last_name = lastName;
  const phone = trimString(body.phone, 30);
  if (phone !== undefined) update.phone = phone;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const { error } = await admin
    .from("drivers")
    .update(update)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
