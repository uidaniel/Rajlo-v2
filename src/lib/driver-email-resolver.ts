import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve a driver's email reliably.
 *
 * Background: `drivers.email` is set during onboarding (typed into the
 * form), but isn't always set for OAuth signups or for driver rows
 * created before the column existed. Without a fallback, every
 * `if (driver.email)` send-email path silently no-ops on those rows
 * and the driver never gets touchpoints they should — verification
 * decisions, vehicle changes, deactivation, etc.
 *
 * Resolution order:
 *   1. drivers.email (if non-empty)
 *   2. auth.users.email (looked up via the admin API on the user_id)
 *
 * Caller passes a service-role Supabase client because the
 * `auth.admin.getUserById` method is privileged.
 *
 * Returns null only when both sources fail (e.g. user account was
 * deleted but driver row still exists) — caller should log + skip.
 */
export async function resolveDriverEmail(
  supabase: SupabaseClient,
  driver: { email?: string | null; user_id?: string | null },
): Promise<string | null> {
  const direct = driver.email?.trim();
  if (direct) return direct;

  if (!driver.user_id) return null;

  try {
    const { data, error } = await supabase.auth.admin.getUserById(
      driver.user_id,
    );
    if (error) return null;
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}
