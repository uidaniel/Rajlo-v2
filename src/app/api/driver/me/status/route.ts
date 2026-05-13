import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/driver/me/status
 *
 * Lightweight check used by the driver portal's activation gate. Returns:
 *   {
 *     hasDriverRecord: boolean,    // is this user actually a driver?
 *     activated: boolean,          // has admin approved their verification?
 *     deactivatedAt: string | null // null when active
 *   }
 *
 * Used to decide whether to:
 *   - Show the web portal (unverified can complete onboarding/check status)
 *   - Redirect web users to /driver/download-app (verified)
 *   - Redirect native-app users to /driver/verify-on-web (unverified)
 */

export const dynamic = "force-dynamic";

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
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, activated, deactivated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    hasDriverRecord: !!driver,
    activated: !!driver?.activated && !driver?.deactivated_at,
    deactivatedAt: (driver?.deactivated_at as string | null) ?? null,
  });
}
