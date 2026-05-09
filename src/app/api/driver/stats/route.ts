import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getAverageRating } from "@/lib/ratings";

/**
 * GET /api/driver/stats
 *
 * One-shot dashboard payload. Aggregates everything the driver-side
 * home screen needs in a single round-trip:
 *
 *   - earnings: today + this week + this month + last week (for the
 *     change indicator)
 *   - tripCounts: same windows
 *   - acceptanceRate: last 30 days, completed / (completed + cancelled-
 *     by-driver) — gives drivers a clean self-monitor signal
 *   - rating: lifetime average + count
 *   - online: { is, since } — pulled from the persisted `drivers`
 *     columns added in the online-status migration
 *
 * Computed in memory from a single-bulk SELECT against `rides`. Caps at
 * 1000 rows; for the Phase 1 pilot fleet that's far past anyone's
 * monthly volume, swap to server-side `count(*)` rollups when it isn't.
 */

const MS_DAY = 24 * 60 * 60 * 1000;

type RideRow = {
  id: string;
  status: string;
  final_fare_jmd: number | null;
  estimated_fare_jmd: number;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  // Resolve driver row.
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, is_online, went_online_at, created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // One bulk fetch of every relevant ride for this driver in the last
  // ~60 days (covers all the windows we report + the comparison
  // window).
  const sixtyDaysAgo = new Date(Date.now() - 60 * MS_DAY).toISOString();
  const { data: rideRows } = await supabase
    .from("rides")
    .select(
      "id, status, final_fare_jmd, estimated_fare_jmd, completed_at, cancelled_at, cancellation_reason",
    )
    .eq("driver_id", driver.id)
    .gte("requested_at", sixtyDaysAgo)
    .in("status", ["completed", "cancelled"])
    .order("requested_at", { ascending: false })
    .limit(1000);

  const rides: RideRow[] = (rideRows ?? []) as RideRow[];

  /* ─── Time windows ─── */
  const now = Date.now();
  const startOfToday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const startOfThisWeek = startOfToday - new Date().getDay() * MS_DAY;
  const startOfLastWeek = startOfThisWeek - 7 * MS_DAY;
  const startOfThisMonth = (() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const last30Cutoff = now - 30 * MS_DAY;

  const fareOf = (r: RideRow) =>
    Math.round(r.final_fare_jmd ?? r.estimated_fare_jmd ?? 0);
  const completedAt = (r: RideRow) =>
    r.completed_at ? new Date(r.completed_at).getTime() : 0;

  const completed = rides.filter((r) => r.status === "completed");
  const cancelled = rides.filter((r) => r.status === "cancelled");
  const cancelledByDriver = cancelled.filter(
    (r) => r.cancellation_reason !== "expired_no_driver",
    // Cleanest proxy: driver explicit cancellations land in
    // cancellation_reason; "expired_no_driver" comes from the system
    // timeout, not the driver, so don't penalise.
  );

  const sumIn = (rows: RideRow[], from: number, to: number = Infinity) =>
    rows
      .filter((r) => completedAt(r) >= from && completedAt(r) < to)
      .reduce((a, r) => a + fareOf(r), 0);
  const countIn = (rows: RideRow[], from: number, to: number = Infinity) =>
    rows.filter((r) => completedAt(r) >= from && completedAt(r) < to).length;

  const earnings = {
    today: sumIn(completed, startOfToday),
    thisWeek: sumIn(completed, startOfThisWeek),
    thisMonth: sumIn(completed, startOfThisMonth),
    lastWeek: sumIn(completed, startOfLastWeek, startOfThisWeek),
  };
  const tripCounts = {
    today: countIn(completed, startOfToday),
    thisWeek: countIn(completed, startOfThisWeek),
    thisMonth: countIn(completed, startOfThisMonth),
    lastWeek: countIn(completed, startOfLastWeek, startOfThisWeek),
  };

  // Per-day earnings for the last 7 days (for the chart strip).
  const dailySeries: Array<{ label: string; spendJMD: number; trips: number }> =
    [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const dayStart = d.getTime();
    const dayEnd = dayStart + MS_DAY;
    dailySeries.push({
      label: d.toLocaleDateString("en-JM", { weekday: "short" }),
      spendJMD: sumIn(completed, dayStart, dayEnd),
      trips: countIn(completed, dayStart, dayEnd),
    });
  }

  /* ─── Acceptance rate (last 30d) ─── */
  const completed30 = completed.filter((r) => completedAt(r) >= last30Cutoff);
  const cancelled30 = cancelledByDriver.filter((r) => {
    const ts = r.cancelled_at ? new Date(r.cancelled_at).getTime() : 0;
    return ts >= last30Cutoff;
  });
  const denom = completed30.length + cancelled30.length;
  const acceptanceRate = denom === 0 ? null : Math.round((completed30.length / denom) * 100);

  /* ─── Rating ─── */
  const ratingSummary = await getAverageRating(supabase, user.id, "driver");

  /* ─── Online ─── */
  const online = {
    is: !!driver.is_online,
    since: driver.went_online_at ?? null,
  };

  /* ─── Period change ─── */
  const change = (curr: number, prev: number) => {
    if (prev === 0) return curr === 0 ? 0 : null;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return NextResponse.json({
    earnings,
    tripCounts,
    weekChangePct: change(earnings.thisWeek, earnings.lastWeek),
    tripsChangePct: change(tripCounts.thisWeek, tripCounts.lastWeek),
    dailySeries,
    acceptanceRate,
    rating: {
      average: ratingSummary.average,
      count: ratingSummary.count,
    },
    online,
    driverSince: driver.created_at,
  });
}
