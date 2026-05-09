import { createSupabaseAuthServerClient } from "./supabase-auth-server";

/**
 * Resolves the right destinations for the public landing-page CTAs
 * ("Book a ride" / "Drive with Rajlo") based on who's signed in.
 *
 * The principle: a returning user shouldn't have to re-traverse a
 * signup funnel to reach the dashboard they already have. So:
 *
 *   "Book a ride"
 *     - signed in as rider  → /rider              (their dashboard)
 *     - everyone else       → /auth/rider/signup  (the existing path)
 *
 *   "Drive with Rajlo"
 *     - signed in as driver → /driver             (their dashboard)
 *     - everyone else       → /driver-join        (the marketing page)
 *
 * We deliberately don't try to be clever for cross-role cases (e.g.
 * a driver tapping "Book a ride") — they fall through to the default
 * signup/marketing flow, which is what they'd want anyway since their
 * driver account isn't a rider account on this platform.
 *
 * Reads through the auth client (anon key + cookies). Safe to call
 * from server components — never throws on a missing session.
 */

export type LandingCtaTargets = {
  riderHref: string;
  driverHref: string;
  /** Whether the rider button should read "My dashboard" vs "Book a ride". */
  riderIsDashboard: boolean;
  /** Whether the driver button should read "Open driver dashboard" vs "Drive with Rajlo". */
  driverIsDashboard: boolean;
};

const DEFAULTS: LandingCtaTargets = {
  riderHref: "/auth/rider/signup",
  driverHref: "/driver-join",
  riderIsDashboard: false,
  driverIsDashboard: false,
};

export async function getLandingCtaTargets(): Promise<LandingCtaTargets> {
  try {
    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return DEFAULTS;

    const { data: profile } = await auth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profile?.role ?? "") as string;
    if (role === "rider") {
      return {
        ...DEFAULTS,
        riderHref: "/rider",
        riderIsDashboard: true,
      };
    }
    if (role === "driver") {
      return {
        ...DEFAULTS,
        driverHref: "/driver",
        driverIsDashboard: true,
      };
    }
    return DEFAULTS;
  } catch {
    // Cookie parse error / Supabase outage — never block the landing
    // page on this. Fall back to the defaults so the page still works.
    return DEFAULTS;
  }
}
