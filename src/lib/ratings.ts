import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Compute a user's average rating across all the ride_ratings rows
 * targeting them. Used to display "driver rating" badges in the
 * rider's live-trip view and history listings.
 *
 * Returns null average + 0 count for users who have no ratings yet —
 * the UI then either hides the badge or shows a "new driver" pill,
 * never a misleading 0.0.
 *
 * Uses the service-role client so we can read across users; RLS only
 * lets the rated party see their own ratings, which would block the
 * rider from seeing their driver's average.
 */
export async function getAverageRating(
  supabase: SupabaseClient,
  ratedUserId: string,
  ratedRole: "driver" | "rider" = "driver",
): Promise<{ average: number | null; count: number }> {
  const { data, error } = await supabase
    .from("ride_ratings")
    .select("stars")
    .eq("rated_id", ratedUserId)
    .eq("rated_role", ratedRole);

  if (error || !data || data.length === 0) {
    return { average: null, count: 0 };
  }
  const total = data.reduce((sum, r) => sum + (r.stars ?? 0), 0);
  const avg = total / data.length;
  // Round to 1dp for clean display.
  return { average: Math.round(avg * 10) / 10, count: data.length };
}
