import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/account/delete
 *
 * User-initiated account deletion. Required by Google Play Store
 * (Article 4.1 — apps with account creation must offer in-app
 * deletion). Same path works for rider, driver, admin, safety
 * officer.
 *
 * Body: { confirm: "DELETE" }
 *   The caller must type "DELETE" exactly in the confirmation
 *   field (server enforces — UI also enforces). Belt-and-suspenders
 *   to prevent accidental API calls or naïve client tampering.
 *
 * Refuses to proceed if:
 *   - The user has any in-flight private ride (status in
 *     requested / accepted / arrived / in_progress)
 *   - The user is a driver with any in-flight assignment
 *   - The user is a driver currently online — must go offline first
 *
 * Deletion model — SOFT delete (anonymise + retain audit trail):
 *
 *   1. `anonymize_user_account(uuid)` runs (see
 *      account-deletion-retention-migration.sql). It strips every
 *      personal identifier — name → "Deleted User", phone, gov IDs,
 *      saved addresses, push tokens, ID-document scans all removed —
 *      but RETAINS the rides, wallet ledger, ratings, safety alerts,
 *      and audit logs so the admin + safety team keep a complete,
 *      readable security + financial trail. The trail now reads as
 *      "Deleted User" rather than a real identity.
 *
 *   2. The `auth.users` row is NOT deleted. Instead it's banned for
 *      ~100 years (so the person can never sign back in) and its
 *      email is scrambled to a tombstone address (so the real email
 *      is freed for a fresh signup and we no longer hold it).
 *      Hard-deleting auth.users would cascade-delete the profile and
 *      orphan every retained record — exactly what we're avoiding.
 *
 * Retained on purpose (must be disclosed in the privacy policy —
 * permitted by Play Article 4.1 for security / fraud / regulatory
 * compliance, and Jamaica tax law requires financial-record
 * retention): rides, ride events, wallet transactions, QR charges,
 * ratings, safety alerts, admin + driver audit logs.
 */

type Body = { confirm?: string };

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      {
        error: "confirmation_required",
        message: "Type DELETE in capitals to confirm deletion.",
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "service_role_missing" },
      { status: 500 },
    );
  }

  // ─── Block if there's an in-flight ride on either side ───
  const ACTIVE_STATUSES = ["requested", "accepted", "arrived", "in_progress"];

  const { count: riderActiveRides } = await supabase
    .from("rides")
    .select("id", { count: "exact", head: true })
    .eq("rider_id", user.id)
    .in("status", ACTIVE_STATUSES);
  if (riderActiveRides && riderActiveRides > 0) {
    return NextResponse.json(
      {
        error: "active_trip",
        message:
          "You have an active trip. Wait for it to finish or cancel it before deleting your account.",
      },
      { status: 409 },
    );
  }

  // If the user is a driver, check active assignments + online state.
  const { data: driverRow } = await supabase
    .from("drivers")
    .select("id, is_online")
    .eq("user_id", user.id)
    .maybeSingle();
  if (driverRow) {
    const { count: driverActiveRides } = await supabase
      .from("rides")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", driverRow.id)
      .in("status", ACTIVE_STATUSES);
    if (driverActiveRides && driverActiveRides > 0) {
      return NextResponse.json(
        {
          error: "active_trip",
          message:
            "You have an active trip with a rider. Finish or cancel it first.",
        },
        { status: 409 },
      );
    }
    if (driverRow.is_online) {
      return NextResponse.json(
        {
          error: "still_online",
          message:
            "Toggle yourself offline before deleting your account so no new ride requests dispatch to you mid-deletion.",
        },
        { status: 409 },
      );
    }
  }

  // ─── Do it ───
  // Step 1: anonymise. Strips all PII but keeps the rides / wallet /
  // audit trail intact for the admin + safety team. Runs first so
  // that if it fails we haven't touched the auth account yet.
  const { error: anonError } = await supabase.rpc("anonymize_user_account", {
    victim_id: user.id,
  });
  if (anonError) {
    return NextResponse.json(
      { error: `anonymize_failed: ${anonError.message}` },
      { status: 500 },
    );
  }

  // Step 2: lock the auth account. We deliberately do NOT call
  // `auth.admin.deleteUser` — that cascades through profiles and
  // would orphan every record Step 1 just preserved. Instead:
  //   - ban for ~100 years  → the person can never sign in again
  //   - scramble the email  → frees the real address for a future
  //                           signup and drops the last PII we held
  //   - clear user_metadata → removes name/phone cached on the JWT
  const tombstoneEmail = `deleted+${user.id}@rajlo.invalid`;
  const { error: lockError } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      ban_duration: "876600h",
      email: tombstoneEmail,
      user_metadata: {},
    },
  );
  if (lockError) {
    // The data is already anonymised at this point — surface the
    // error so the client knows the auth lock didn't complete, but
    // the user's personal data is already gone either way.
    return NextResponse.json(
      { error: `auth_lock_failed: ${lockError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
