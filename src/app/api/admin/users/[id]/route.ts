import { NextResponse } from "next/server";
import { logAdminAction, requireAdmin } from "@/lib/admin-auth";

/**
 * GET    /api/admin/users/[id]    full user detail
 * DELETE /api/admin/users/[id]    hard-delete the auth user (cascades to
 *                                  profile, drivers, rides, ratings via
 *                                  ON DELETE CASCADE on each FK)
 *
 * Detail returns:
 *   - profile + auth metadata
 *   - driver row (if any)
 *   - rides count, last ride
 *   - rating summary (if rated)
 *   - audit log entries that target this user
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let email: string | null = null;
  let lastSignInAt: string | null = null;
  let banned = false;
  let createdAt = (profile as { created_at: string }).created_at;
  try {
    const { data: authData } = await supabase.auth.admin.getUserById(id);
    if (authData?.user) {
      email = authData.user.email ?? null;
      lastSignInAt = authData.user.last_sign_in_at ?? null;
      createdAt = authData.user.created_at ?? createdAt;
      banned =
        Boolean(authData.user.banned_until) &&
        new Date(authData.user.banned_until!).getTime() > Date.now();
    }
  } catch (e) {
    console.error(
      "auth.admin.getUserById failed:",
      e instanceof Error ? e.message : "unknown error",
    );
  }

  // Driver enrichment
  const { data: driver } = await supabase
    .from("drivers")
    .select(
      "id, external_id, plate_number, vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, activated, onboarding_status, deactivated_at, admin_note, is_online, went_online_at, submitted_at",
    )
    .eq("user_id", id)
    .maybeSingle();

  // Activity counts
  let ridesAsRider = 0;
  let ridesAsDriver = 0;
  let lifetimeSpend = 0;
  let lifetimeEarnings = 0;
  let lastRideAt: string | null = null;

  const { data: riderRides } = await supabase
    .from("rides")
    .select("id, status, final_fare_jmd, requested_at")
    .eq("rider_id", id)
    .order("requested_at", { ascending: false });
  const riderRows = (riderRides ?? []) as Array<{
    id: string;
    status: string;
    final_fare_jmd: number | null;
    requested_at: string;
  }>;
  ridesAsRider = riderRows.length;
  lifetimeSpend = riderRows
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + (r.final_fare_jmd ?? 0), 0);
  if (riderRows.length > 0) lastRideAt = riderRows[0].requested_at;

  if (driver?.id) {
    const { data: drvRides } = await supabase
      .from("rides")
      .select("id, status, final_fare_jmd, requested_at")
      .eq("driver_id", driver.id)
      .order("requested_at", { ascending: false });
    const drvRows = (drvRides ?? []) as Array<{
      id: string;
      status: string;
      final_fare_jmd: number | null;
      requested_at: string;
    }>;
    ridesAsDriver = drvRows.length;
    lifetimeEarnings = drvRows
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + (r.final_fare_jmd ?? 0), 0);
    if (drvRows.length > 0 && (!lastRideAt || drvRows[0].requested_at > lastRideAt)) {
      lastRideAt = drvRows[0].requested_at;
    }
  }

  // Ratings — both directions
  const ratingsAsDriverP = supabase
    .from("ride_ratings")
    .select("stars, comment, created_at")
    .eq("rated_id", id)
    .eq("rated_role", "driver");
  const ratingsAsRiderP = supabase
    .from("ride_ratings")
    .select("stars, comment, created_at")
    .eq("rated_id", id)
    .eq("rated_role", "rider");
  const ratingsGivenP = supabase
    .from("ride_ratings")
    .select("stars")
    .eq("rater_id", id);

  const [ratingsAsDriver, ratingsAsRider, ratingsGiven] = await Promise.all([
    ratingsAsDriverP,
    ratingsAsRiderP,
    ratingsGivenP,
  ]);

  const summarise = (rows: { stars: number }[] | null | undefined) => {
    if (!rows || rows.length === 0) return { count: 0, average: null };
    const avg = rows.reduce((s, r) => s + r.stars, 0) / rows.length;
    return { count: rows.length, average: Math.round(avg * 10) / 10 };
  };

  // Audit log entries targeting this user
  const { data: audits } = await supabase
    .from("admin_audit_logs")
    .select("id, action, summary, actor_label, created_at, metadata")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    profile: {
      id: profile.id,
      fullName: profile.full_name ?? "Unnamed user",
      phone: profile.phone,
      role: profile.role,
      createdAt,
      updatedAt: (profile as { updated_at: string }).updated_at,
    },
    auth: {
      email,
      lastSignInAt,
      banned,
    },
    driver,
    activity: {
      ridesAsRider,
      ridesAsDriver,
      lifetimeSpend,
      lifetimeEarnings,
      lastRideAt,
    },
    ratings: {
      asDriver: summarise(ratingsAsDriver.data as { stars: number }[] | null),
      asRider: summarise(ratingsAsRider.data as { stars: number }[] | null),
      given: summarise(ratingsGiven.data as { stars: number }[] | null),
      latest: ((ratingsAsDriver.data ?? []) as Array<{
        stars: number;
        comment: string | null;
        created_at: string;
      }>).slice(0, 5),
    },
    audits: audits ?? [],
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;

  if (id === actor.userId) {
    return NextResponse.json(
      { error: "You can't delete your own admin account." },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Best-effort: delete the auth user. ON DELETE CASCADE on profiles +
  // drivers + rides + ratings cleans up the rest. If the auth call
  // fails, we surface the error and leave the database untouched.
  const { error: authError } = await supabase.auth.admin.deleteUser(id);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  await logAdminAction(supabase, actor, {
    targetType:
      profile.role === "driver"
        ? "driver"
        : profile.role === "admin"
          ? "admin"
          : "rider",
    targetId: id,
    targetLabel: profile.full_name ?? "Unnamed user",
    action: "delete",
    summary: `${actor.label} deleted ${profile.role} account ${profile.full_name ?? id}`,
  });

  return NextResponse.json({ ok: true });
}
