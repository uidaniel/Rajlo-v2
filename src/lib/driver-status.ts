import { createSupabaseAuthServerClient } from "./supabase-auth-server";
import { getSupabaseServerClient } from "./supabase-server";

/**
 * Server-side helper that classifies the signed-in user's driver-onboarding
 * state. Used by the driver portal layout + /driver/pending + /driver/onboarding
 * to gate access and route the user to the correct screen.
 *
 * IMPORTANT: This function uses the auth-server client (anon key + cookies)
 * only to verify identity, then switches to the service_role admin client
 * for the actual `drivers` lookup. This is intentional:
 *   1. Identity is established via the user's verified session cookie.
 *   2. The drivers lookup explicitly filters by that verified user.id.
 *   3. Bypassing RLS for this internal lookup avoids the trap where a
 *      missing/incorrect SELECT policy on drivers makes the query silently
 *      return nothing — which would loop the driver back to /onboarding.
 */

type DriverRecord = {
  id: string;
  activated: boolean;
  onboarding_status: string;
  created_at: string;
  submitted_at: string | null;
  deactivated_at: string | null;
  admin_note: string | null;
};

export type DriverStatus =
  | { state: "unauthenticated" }
  | { state: "not_a_driver"; userId: string }
  | { state: "needs_onboarding"; userId: string }
  | { state: "pending_verification"; userId: string; driver: DriverRecord }
  | { state: "rejected"; userId: string; driver: DriverRecord }
  | { state: "deactivated"; userId: string; driver: DriverRecord }
  | { state: "active"; userId: string; driver: DriverRecord };

export async function getDriverStatus(): Promise<DriverStatus> {
  // 1. Establish identity from the user's session cookie (anon-key client)
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { state: "unauthenticated" };

  // 2. Use service_role for the role + driver lookups so RLS can't silently
  //    hide the row. Lookups are still scoped to the verified user.id.
  const admin = getSupabaseServerClient();
  if (!admin) {
    // No service_role configured (dev fallback) — fall back to auth client.
    return await fallbackWithAuthClient(auth, user.id);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "driver") {
    return { state: "not_a_driver", userId: user.id };
  }

  const { data: driver } = await admin
    .from("drivers")
    .select("id, activated, onboarding_status, created_at, submitted_at, deactivated_at, admin_note")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!driver) return { state: "needs_onboarding", userId: user.id };
  if (driver.activated) return { state: "active", userId: user.id, driver };
  // Deactivation takes precedence over onboarding_status — admin pulled them
  // out of the active pool, so even though onboarding_status is back to
  // pending_review, the message we show is "Account deactivated".
  if (driver.deactivated_at) {
    return { state: "deactivated", userId: user.id, driver };
  }
  if (driver.onboarding_status === "rejected") {
    return { state: "rejected", userId: user.id, driver };
  }
  return { state: "pending_verification", userId: user.id, driver };
}

/**
 * Dev-only fallback when service_role isn't configured. Same logic but uses
 * the anon-key (RLS-respecting) client.
 */
async function fallbackWithAuthClient(
  auth: Awaited<ReturnType<typeof createSupabaseAuthServerClient>>,
  userId: string,
): Promise<DriverStatus> {
  const { data: profile } = await auth
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profile?.role !== "driver") {
    return { state: "not_a_driver", userId };
  }
  const { data: driver } = await auth
    .from("drivers")
    .select("id, activated, onboarding_status, created_at, submitted_at, deactivated_at, admin_note")
    .eq("user_id", userId)
    .maybeSingle();
  if (!driver) return { state: "needs_onboarding", userId };
  if (driver.activated) return { state: "active", userId, driver };
  if (driver.deactivated_at) {
    return { state: "deactivated", userId, driver };
  }
  if (driver.onboarding_status === "rejected") {
    return { state: "rejected", userId, driver };
  }
  return { state: "pending_verification", userId, driver };
}
