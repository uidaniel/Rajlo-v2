import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import {
  sendWelcomeRiderEmail,
  sendWelcomeDriverEmail,
} from "@/lib/email-templates";

/**
 * POST /api/auth/welcome
 *
 * Sends the role-appropriate welcome email after a successful Supabase
 * signup. Supabase Auth doesn't fire server-side webhooks unless you
 * configure them at the project level, so the signup client calls this
 * endpoint once `supabase.auth.signUp` resolves (or after the user
 * confirms their email, depending on flow).
 *
 * This is a "best-effort" endpoint — we always return ok:true so a
 * delivery failure doesn't surface as a noisy error in the signup UI.
 * Email delivery itself is idempotent enough that the rare double-call
 * (e.g. user double-tapping "verify") just sends two welcome emails.
 *
 * Auth: requires the freshly-signed-in user. We use their session to
 * look up the email + role, NOT the request body, so this can't be
 * abused to spam other people's inboxes.
 */
export async function POST() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" });
  }

  const { data: profile } = await auth
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "rider";
  const fullName = profile?.full_name ?? null;

  if (role === "driver") {
    await sendWelcomeDriverEmail(user.email, { fullName });
  } else {
    // Default rider welcome covers both 'rider' and any unrecognized role.
    await sendWelcomeRiderEmail(user.email, { fullName });
  }

  return NextResponse.json({ ok: true });
}
