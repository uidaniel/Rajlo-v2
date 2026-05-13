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
 * Side effects:
 *   - `auth.users` row deleted via `supabase.auth.admin.deleteUser`
 *   - The `on_auth_user_before_delete` trigger
 *     (user-delete-cascade-migration.sql) wipes every public-schema
 *     row owned by this user atomically: rides, ratings, messages,
 *     wallet, push subs, notifications, driver record + docs,
 *     trusted contacts, etc.
 *   - Trip share links the user issued get tombstoned by the same
 *     cascade.
 *
 * NOT deleted (intentionally retained, per privacy policy):
 *   - Other users' rides where this user appears as the OTHER
 *     party — those rows mention the user via a UUID that now
 *     points at nothing. The driver / rider on the other side
 *     keeps their trip history. The deleted user's identity is
 *     gone (cascade clears profiles), so the row reads as "Unknown".
 *   - Admin audit logs: actor_id is set to NULL but the action
 *     summary stays for compliance / dispute review.
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
  // The `on_auth_user_before_delete` trigger runs first inside the
  // same transaction and wipes every public.* row owned by this user.
  // If anything in the trigger fails, the auth.users delete rolls
  // back too — no half-deleted state.
  const { error: deleteError } = await supabase.auth.admin.deleteUser(
    user.id,
  );
  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
