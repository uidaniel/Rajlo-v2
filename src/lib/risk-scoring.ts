import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Account risk scoring engine.
 *
 * Produces a 0–100 risk score per user from the fraud signals the
 * backend can genuinely observe, with the band mapping from the spec:
 *   0–20 low · 21–50 moderate · 51–75 high · 76–100 critical
 *
 * The score is a transparent weighted sum — every contribution is
 * visible in the returned `signals` breakdown so an admin reviewing a
 * high score can see exactly why it's high. New signals plug in by
 * adding a field + a weight; nothing else changes.
 */

export type RiskLevel = "low" | "moderate" | "high" | "critical";

/** Observable inputs to the score. */
export type RiskSignals = {
  /** Age of the account in days — brand-new accounts carry more risk. */
  accountAgeDays: number;
  /** Unresolved fraud flags on the account. */
  openFraudFlags: number;
  /** Unresolved fraud flags at "critical" severity. */
  criticalFraudFlags: number;
  /** Rides the user cancelled. */
  cancelledRides: number;
  /** Total rides the user has taken part in. */
  totalRides: number;
  /** Distinct OTHER accounts seen on the same device fingerprint. */
  sharedDeviceAccounts: number;
  /** Distinct OTHER accounts seen on the same IP address. */
  sharedIpAccounts: number;
};

export type RiskResult = {
  score: number;
  level: RiskLevel;
  /** Per-signal point contributions — the "why" behind the score. */
  breakdown: Record<string, number>;
};

function levelFor(score: number): RiskLevel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 21) return "moderate";
  return "low";
}

/** Pure scoring — weighted sum of signals, clamped to 0–100. */
export function scoreFromSignals(signals: RiskSignals): RiskResult {
  const breakdown: Record<string, number> = {};

  // Brand-new accounts: fraud rings spin up fresh accounts constantly.
  breakdown.newAccount =
    signals.accountAgeDays < 2 ? 15 : signals.accountAgeDays < 7 ? 7 : 0;

  // Open fraud flags — each one adds risk, capped so flags alone don't
  // saturate the score.
  breakdown.openFlags = Math.min(40, signals.openFraudFlags * 10);
  breakdown.criticalFlags = Math.min(40, signals.criticalFraudFlags * 20);

  // Cancellation abuse — only meaningful with a real sample of rides.
  const cancelRatio =
    signals.totalRides >= 4
      ? signals.cancelledRides / signals.totalRides
      : 0;
  breakdown.cancellations =
    cancelRatio > 0.6 ? 20 : cancelRatio > 0.4 ? 10 : 0;

  // Multi-account / fraud-ring signals — the same device or IP behind
  // several accounts.
  breakdown.sharedDevice = Math.min(30, signals.sharedDeviceAccounts * 15);
  breakdown.sharedIp =
    signals.sharedIpAccounts > 2 ? 10 : signals.sharedIpAccounts > 0 ? 4 : 0;

  const score = Math.max(
    0,
    Math.min(
      100,
      Object.values(breakdown).reduce((sum, v) => sum + v, 0),
    ),
  );
  return { score, level: levelFor(score), breakdown };
}

/**
 * Gather a user's signals, score them, and upsert the result into
 * `fraud_risk_scores`. Pass a service-role client. Returns the result
 * (also when the write is skipped) so callers can act on it.
 */
export async function recalculateRiskScore(
  supabase: SupabaseClient,
  userId: string,
  role: string,
): Promise<RiskResult> {
  // Account age.
  let accountAgeDays = 9999;
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.created_at) {
    accountAgeDays =
      (Date.now() - new Date(profile.created_at as string).getTime()) /
      86_400_000;
  }

  // Open fraud flags.
  const { data: flags } = await supabase
    .from("fraud_flags")
    .select("severity")
    .eq("user_id", userId)
    .is("resolved_at", null);
  const openFraudFlags = flags?.length ?? 0;
  const criticalFraudFlags = (flags ?? []).filter(
    (f) => (f as { severity: string }).severity === "critical",
  ).length;

  // Ride history — count cancellations vs total for whichever side the
  // user plays.
  const rideColumn = role === "driver" ? "driver_id" : "rider_id";
  const { data: rides } = await supabase
    .from("rides")
    .select("status")
    .eq(rideColumn, userId);
  const totalRides = rides?.length ?? 0;
  const cancelledRides = (rides ?? []).filter((r) =>
    String((r as { status: string }).status).startsWith("cancel"),
  ).length;

  // Multi-account signals — other accounts sharing this user's
  // device fingerprints / IPs.
  const { data: fps } = await supabase
    .from("device_fingerprints")
    .select("fingerprint_hash, ip_address")
    .eq("user_id", userId);
  const hashes = [
    ...new Set((fps ?? []).map((f) => (f as { fingerprint_hash: string }).fingerprint_hash)),
  ];
  const ips = [
    ...new Set(
      (fps ?? [])
        .map((f) => (f as { ip_address: string | null }).ip_address)
        .filter((v): v is string => Boolean(v)),
    ),
  ];

  const sharedDeviceAccounts = await countOtherAccounts(
    supabase,
    userId,
    "fingerprint_hash",
    hashes,
  );
  const sharedIpAccounts = await countOtherAccounts(
    supabase,
    userId,
    "ip_address",
    ips,
  );

  const result = scoreFromSignals({
    accountAgeDays,
    openFraudFlags,
    criticalFraudFlags,
    cancelledRides,
    totalRides,
    sharedDeviceAccounts,
    sharedIpAccounts,
  });

  await supabase.from("fraud_risk_scores").upsert(
    {
      user_id: userId,
      role,
      risk_score: result.score,
      risk_level: result.level,
      signals: result.breakdown,
      last_calculated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return result;
}

/** Count distinct OTHER user ids sharing any of the given values in a
 *  device_fingerprints column. */
async function countOtherAccounts(
  supabase: SupabaseClient,
  userId: string,
  column: "fingerprint_hash" | "ip_address",
  values: string[],
): Promise<number> {
  if (values.length === 0) return 0;
  const { data } = await supabase
    .from("device_fingerprints")
    .select("user_id")
    .in(column, values)
    .neq("user_id", userId);
  return new Set(
    (data ?? []).map((r) => (r as { user_id: string }).user_id),
  ).size;
}
