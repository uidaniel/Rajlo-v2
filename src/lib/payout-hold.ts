import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true when a driver has an unreleased payout hold. The wallet
 * withdrawal path calls this before letting a payout through.
 */
export async function hasActivePayoutHold(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("payout_holds")
    .select("id", { count: "exact", head: true })
    .eq("driver_user_id", driverUserId)
    .is("released_at", null);
  return Boolean(count && count > 0);
}
