import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getDriverSelfieUrl } from "@/lib/driver-selfie";

/**
 * GET /api/me/avatar
 *
 * Returns the right avatar URL for the signed-in user, with the
 * selfie taking priority when available. Used by the sidebar / drawer
 * so the driver's verified TA photo shows up there instead of the
 * generic OAuth picture.
 *
 * Resolution order:
 *   1. If user is a driver AND has uploaded a selfie → signed URL of that
 *   2. profiles.avatar_url (synced from Google OAuth on sign-in)
 *   3. user_metadata.avatar_url / picture as a final fallback
 *
 * Returns null if none of the above produce a value.
 */
export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    // No service role — fall back to whatever's on the user metadata so
    // the page can still render something.
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fallback =
      (typeof meta.avatar_url === "string" ? meta.avatar_url : null) ??
      (typeof meta.picture === "string" ? meta.picture : null);
    return NextResponse.json({ avatarUrl: fallback, source: "oauth" });
  }

  // Pull the role + OAuth avatar from profiles.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // Try the selfie first if this user is a driver.
  if (profile?.role === "driver") {
    const { data: driver } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (driver?.id) {
      const selfie = await getDriverSelfieUrl(supabase, driver.id);
      if (selfie) {
        return NextResponse.json({ avatarUrl: selfie, source: "selfie" });
      }
    }
  }

  // Fall back to the OAuth-synced avatar on profiles, then the raw
  // user_metadata. Some signups via password-only paths leave both
  // null — we return null in that case and the caller renders initials.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const oauth =
    profile?.avatar_url ??
    (typeof meta.avatar_url === "string" ? meta.avatar_url : null) ??
    (typeof meta.picture === "string" ? meta.picture : null);

  return NextResponse.json({ avatarUrl: oauth, source: "oauth" });
}
