import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tells you whether a signed-in user is brand-new — i.e. this is their
 * very first session — so the welcome email only fires for genuine
 * sign-ups, never for re-logins.
 *
 * Two signals, both must agree:
 *
 *   1. `welcome_sent_at` flag in user_metadata is missing — guards
 *      against double-fires inside the same signup flow (e.g. user
 *      double-clicks the magic link).
 *
 *   2. Time between `created_at` and `last_sign_in_at` is < 60s —
 *      guards against the bigger problem: users who signed up BEFORE
 *      the flag existed have no `welcome_sent_at` in metadata, but
 *      they're not new. Without this check they'd get a "welcome"
 *      every time they signed back in. After their first ever sign-in
 *      the gap is days/weeks, so they're correctly excluded.
 *
 * For brand-new users `created_at` and `last_sign_in_at` are populated
 * by Supabase within the same auth transaction, so they end up within
 * a couple of milliseconds of each other. 60s is a wide safety margin.
 */
export function isBrandNewUser(user: User): boolean {
  if (!user.email) return false;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (meta.welcome_sent_at) return false;
  if (!user.created_at) return false;
  // No prior sign-in at all → this is definitely the first time.
  if (!user.last_sign_in_at) return true;
  const created = new Date(user.created_at).getTime();
  const lastSignIn = new Date(user.last_sign_in_at).getTime();
  if (Number.isNaN(created) || Number.isNaN(lastSignIn)) return false;
  return Math.abs(created - lastSignIn) < 60_000;
}

/**
 * Marks the user's `welcome_sent_at` flag. Caller should write this
 * BEFORE sending the email — that way, if two callbacks race (rare but
 * possible: tab reload, OAuth redirect double-click), the second one
 * reads the flag set by the first and skips. Better to occasionally
 * miss a welcome email than to send two.
 *
 * Best-effort — never throws. Returns `true` on success so the caller
 * can decide what to do on failure (typically: send anyway, since the
 * read-side gate will catch most duplicates).
 */
export async function markWelcomeSent(
  admin: SupabaseClient,
  user: User,
): Promise<boolean> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      welcome_sent_at: new Date().toISOString(),
    },
  });
  if (error) {
    console.error("markWelcomeSent failed:", error.message);
    return false;
  }
  return true;
}
