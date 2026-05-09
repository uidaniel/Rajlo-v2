import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/driver/heartbeat
 *
 * Called periodically by the driver portal's `<DriverActivityTracker>`
 * while the driver is interacting with the app. Two responsibilities:
 *
 *   1. **Update the calling driver's `last_active_at`** so the
 *      auto-offline sweep (below) doesn't flip them off.
 *
 *   2. **Run the auto-offline sweep**: any driver who's `is_online`
 *      but hasn't sent a heartbeat in over an hour gets flipped
 *      offline. We do this lazily here (every heartbeat does the
 *      sweep) instead of via a scheduled cron because:
 *        - There's always at least one online driver pinging while
 *          the platform has any activity at all
 *        - One indexed UPDATE every few minutes is cheaper than a
 *          standalone cron worker
 *        - Self-healing: if heartbeats stop entirely, the next
 *          rider-side `select online drivers` will simply return
 *          none — exactly what we want.
 *
 * Body (optional):
 *   { setOffline?: boolean }
 *   When `setOffline: true`, the caller's `is_online` is also flipped
 *   to false in addition to the heartbeat update. Used by the client
 *   when it detects local idle (no user interaction for an hour) so
 *   the driver doesn't have to wait for the server-side sweep to
 *   notice — they're flipped offline immediately.
 *
 * Always returns 200 — the heartbeat is best-effort and never gates
 * the driver portal on the network call.
 */

// 1 hour of inactivity flips an online driver back offline. Adjust
// here if the platform ever wants a tighter or looser window.
const STALE_THRESHOLD_MS = 60 * 60 * 1000;

type Body = { setOffline?: unknown };

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "no_service_role" });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const wantsOffline = body.setOffline === true;

  // Self heartbeat — also flips offline when the caller asked for it.
  const updates: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
  };
  if (wantsOffline) updates.is_online = false;

  await supabase
    .from("drivers")
    .update(updates)
    .eq("user_id", user.id);

  // Lazy expire — flip stale online drivers offline. Indexed by
  // `idx_drivers_online_last_active` so this is a partial-index scan
  // over only currently-online drivers, not the whole table.
  // We compute the threshold in JS rather than asking Postgres for
  // `now() - interval '1 hour'` because the supabase-js builder
  // doesn't accept raw SQL fragments in `.lt()` filters.
  const staleThreshold = new Date(
    Date.now() - STALE_THRESHOLD_MS,
  ).toISOString();
  await supabase
    .from("drivers")
    .update({ is_online: false })
    .eq("is_online", true)
    .lt("last_active_at", staleThreshold);

  return NextResponse.json({ ok: true });
}
