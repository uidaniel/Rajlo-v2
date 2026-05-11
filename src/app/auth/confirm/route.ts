import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /auth/confirm
 *
 * Lands here when a user taps the link in a Supabase auth email
 * (signup confirmation, password recovery, magic link, invite, email
 * change). The email is rendered by our own webhook at
 * /api/auth/email-hook, and we deliberately route the action through
 * THIS route — not Supabase's hosted `/auth/v1/verify` — so:
 *
 *   1. The URL stays on rajlo.com — no jarring jump to `*.supabase.co`
 *   2. We don't need to expose the anon key in the email URL (Supabase's
 *      hosted endpoint requires it as a query param, ours doesn't)
 *   3. We can show a branded error UI when a link is expired / used
 *   4. We can route post-verify based on the rider's role
 *
 * Expected query params:
 *   - `token_hash` — the hash Supabase generated in the email payload
 *   - `type`       — one of: signup | invite | magiclink | recovery
 *                    | email_change | email
 *   - `next`       — optional redirect target after success
 *
 * On success we redirect to:
 *   - `recovery` action → `/auth/reset-password` (the form where they
 *     set their new password — the session is now elevated so the
 *     update succeeds)
 *   - everything else → the `next` param or `/rider` as a sensible
 *     default. The role-aware home page will reroute drivers /
 *     admins from there.
 *
 * On failure we bounce to the right login page with an `error` param
 * the page already knows how to render (`link_expired`, `auth_failed`,
 * etc.).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") || "") as EmailOtpType | "";
  const nextParam = searchParams.get("next") ?? "";

  const loginUrl = (errorMsg: string) => {
    // Send the user back to the login page that matches where they
    // most likely started — drivers to the driver login, etc.
    const base = nextParam.startsWith("/driver")
      ? "/auth/driver/login"
      : nextParam.startsWith("/admin")
        ? "/auth/admin/login"
        : "/auth/rider/login";
    return `${origin}${base}?error=${encodeURIComponent(errorMsg)}`;
  };

  if (!tokenHash || !type) {
    return NextResponse.redirect(loginUrl("link_expired"));
  }

  const supabase = await createSupabaseAuthServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(loginUrl(error.message || "auth_failed"));
  }

  // Post-verify routing.
  // For recovery (password reset), drop the user on the
  // /auth/reset-password page where they set the new password —
  // their session is now elevated by verifyOtp so the update goes
  // through. For every other action we send them to `next` if
  // provided or to `/rider` as the default landing.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }
  const safeNext = nextParam.startsWith("/") ? nextParam : "/rider";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
