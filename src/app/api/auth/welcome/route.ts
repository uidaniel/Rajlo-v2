import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
  sendWelcomeRiderEmail,
  sendWelcomeDriverEmail,
} from "@/lib/email-templates";
import { isBrandNewUser, markWelcomeSent } from "@/lib/welcome-gate";

/**
 * POST /api/auth/welcome
 *
 * Idempotent welcome-email trigger that signup clients can call once
 * `supabase.auth.signUp` resolves. Supabase Auth doesn't fire
 * server-side webhooks unless you configure them at the project level,
 * so this is the bridge.
 *
 * Critically — only sends to genuinely-new users. The `isBrandNewUser`
 * helper combines two checks:
 *
 *   1. `welcome_sent_at` flag in user_metadata is missing
 *   2. created_at and last_sign_in_at are within 60s of each other
 *
 * #2 is what protects returning users: even if their metadata is
 * missing the flag (e.g. they signed up before the flag existed), the
 * fact that they've signed in before will exclude them. A re-login
 * triggered by an over-eager client never sends a duplicate welcome.
 *
 * Auth: requires the freshly-signed-in user. We use their session to
 * look up email + role, NOT the request body, so this can't be abused
 * to spam other people's inboxes.
 *
 * Always returns 200 — delivery is best-effort and shouldn't surface
 * as a noisy error in the signup UI.
 */
export async function POST() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" });
  }

  if (!isBrandNewUser(user)) {
    return NextResponse.json({ ok: true, sent: false, reason: "not_new" });
  }

  const { data: profile } = await auth
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "rider";
  const fullName = profile?.full_name ?? null;

  // Mark first so a concurrent invocation reads the flag and bails.
  // Better to occasionally miss a welcome than to send two.
  const admin = getSupabaseServerClient();
  if (admin) {
    await markWelcomeSent(admin, user);
  }

  if (role === "driver") {
    await sendWelcomeDriverEmail(user.email, { fullName });
  } else {
    // Default rider welcome covers both 'rider' and any unrecognized role.
    await sendWelcomeRiderEmail(user.email, { fullName });
  }

  return NextResponse.json({ ok: true, sent: true });
}
