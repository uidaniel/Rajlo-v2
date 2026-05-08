import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/rider/analytics
 *
 * Aggregates the rider's spending into the shape the analytics page
 * needs to render every card + chart. One bulk query against `rides`
 * (capped at 1000 rows for safety), then everything is computed in
 * memory — no SQL `GROUP BY`, so the same code path works on
 * Postgres or any future migration target.
 *
 * Returned shape:
 *   - totals          lifetime + last 30d + last 7d + this month + averages
 *   - compare         spend / trip change vs the previous 30-day window
 *   - trend           last 12 months of (spend, trips), oldest → newest
 *   - byParish        spend per pickup parish, descending
 *   - topRoutes       most-frequent pickup → dropoff pairs
 *   - cancelled       count + saved-by-cancellation total
 *   - carpool         carpool trip count
 *
 * Counts only `completed` rides for spending. `cancelled` rides are
 * tracked separately as "money saved by cancelling" rather than
 * dumped into the spend pile.
 */

type Ride = {
  id: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  pickup_name: string;
  dropoff_name: string;
  pickup_parish: string | null;
  dropoff_parish: string | null;
  final_fare_jmd: number | null;
  estimated_fare_jmd: number;
  estimated_distance_km: number | null;
  carpool_group_id: string | null;
};

const MS_DAY = 24 * 60 * 60 * 1000;

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

  const { data: rides, error } = await supabase
    .from("rides")
    .select(
      "id, status, requested_at, completed_at, cancelled_at, pickup_name, dropoff_name, pickup_parish, dropoff_parish, final_fare_jmd, estimated_fare_jmd, estimated_distance_km, carpool_group_id",
    )
    .eq("rider_id", user.id)
    .in("status", ["completed", "cancelled"])
    .order("requested_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const all: Ride[] = (rides ?? []) as Ride[];
  const completed = all.filter((r) => r.status === "completed");
  const cancelled = all.filter((r) => r.status === "cancelled");

  const fareOf = (r: Ride): number =>
    Math.round(r.final_fare_jmd ?? r.estimated_fare_jmd ?? 0);
  const dateOf = (r: Ride): Date =>
    new Date(r.completed_at ?? r.cancelled_at ?? r.requested_at);

  const now = Date.now();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  /* ─────────── Totals ─────────── */
  const sum = (rows: Ride[]) => rows.reduce((a, r) => a + fareOf(r), 0);

  const completedLast30 = completed.filter(
    (r) => now - dateOf(r).getTime() <= 30 * MS_DAY,
  );
  const completedLast7 = completed.filter(
    (r) => now - dateOf(r).getTime() <= 7 * MS_DAY,
  );
  const completedThisMonth = completed.filter(
    (r) => dateOf(r).getTime() >= startOfMonth.getTime(),
  );

  const totalLifetime = sum(completed);
  const totalLast30 = sum(completedLast30);

  // Previous 30-day window (days 30–60 ago) for the change indicator.
  const completedPrev30 = completed.filter((r) => {
    const age = now - dateOf(r).getTime();
    return age > 30 * MS_DAY && age <= 60 * MS_DAY;
  });
  const totalPrev30 = sum(completedPrev30);
  const pct = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr === 0 ? 0 : null;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const distances = completed
    .map((r) => r.estimated_distance_km)
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const longestTripKm = distances.length > 0 ? Math.max(...distances) : null;

  /* ─────────── 12-month trend ─────────── */
  // Build a map of YYYY-MM → { trips, spend } seeded with the last 12
  // months so months with no rides still show a zero bar.
  const trendKeys: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    trendKeys.push(monthKey(d));
  }
  const trendMap = new Map<string, { trips: number; spend: number }>(
    trendKeys.map((k) => [k, { trips: 0, spend: 0 }]),
  );
  for (const r of completed) {
    const k = monthKey(dateOf(r));
    const slot = trendMap.get(k);
    if (slot) {
      slot.trips += 1;
      slot.spend += fareOf(r);
    }
  }
  const trend = trendKeys.map((k) => {
    const slot = trendMap.get(k)!;
    return {
      key: k,
      label: monthLabel(k),
      trips: slot.trips,
      spendJMD: slot.spend,
    };
  });

  /* ─────────── By parish ─────────── */
  const parishMap = new Map<string, { trips: number; spend: number }>();
  for (const r of completed) {
    // Use pickup_parish as primary signal — that's where the rider is
    // actually consuming the service from. Falls back to dropoff
    // parish if pickup is missing (e.g., free-form pickup like "Home").
    const parish = r.pickup_parish ?? r.dropoff_parish;
    if (!parish) continue;
    const slot = parishMap.get(parish) ?? { trips: 0, spend: 0 };
    slot.trips += 1;
    slot.spend += fareOf(r);
    parishMap.set(parish, slot);
  }
  const byParish = Array.from(parishMap.entries())
    .map(([parish, v]) => ({ parish, trips: v.trips, spendJMD: v.spend }))
    .sort((a, b) => b.spendJMD - a.spendJMD);

  /* ─────────── Top routes ─────────── */
  const routeMap = new Map<
    string,
    { pickup: string; dropoff: string; trips: number; spend: number }
  >();
  for (const r of completed) {
    const key = `${r.pickup_name} → ${r.dropoff_name}`;
    const slot = routeMap.get(key) ?? {
      pickup: r.pickup_name,
      dropoff: r.dropoff_name,
      trips: 0,
      spend: 0,
    };
    slot.trips += 1;
    slot.spend += fareOf(r);
    routeMap.set(key, slot);
  }
  const topRoutes = Array.from(routeMap.values())
    .sort((a, b) => b.trips - a.trips || b.spend - a.spend)
    .slice(0, 5)
    .map((r) => ({
      pickup: r.pickup,
      dropoff: r.dropoff,
      trips: r.trips,
      spendJMD: r.spend,
    }));

  /* ─────────── Cancelled / saved + carpool ─────────── */
  const savedByCancellation = sum(cancelled);
  const carpoolTrips = completed.filter((r) => !!r.carpool_group_id).length;

  return NextResponse.json({
    totals: {
      lifetime: { trips: completed.length, spendJMD: totalLifetime },
      last30Days: {
        trips: completedLast30.length,
        spendJMD: totalLast30,
      },
      last7Days: {
        trips: completedLast7.length,
        spendJMD: sum(completedLast7),
      },
      thisMonth: {
        trips: completedThisMonth.length,
        spendJMD: sum(completedThisMonth),
      },
      averageFareJMD:
        completed.length > 0
          ? Math.round(totalLifetime / completed.length)
          : 0,
      longestTripKm,
    },
    compare: {
      spendChangePct: pct(totalLast30, totalPrev30),
      tripsChangePct: pct(completedLast30.length, completedPrev30.length),
    },
    trend,
    byParish,
    topRoutes,
    cancelled: {
      count: cancelled.length,
      savedJMD: savedByCancellation,
    },
    carpool: {
      trips: carpoolTrips,
    },
  });
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  // Render "Mar '26" style — short enough to fit under bars on
  // mobile, no ambiguity since year is appended for early months.
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date
    .toLocaleString("en-JM", { month: "short", year: "2-digit" })
    .replace(",", "");
}
