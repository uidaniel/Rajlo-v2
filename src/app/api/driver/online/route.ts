import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET / PATCH /api/driver/online
 *
 * GET    → returns { online: boolean, wentOnlineAt: string | null }
 * PATCH  → body { online: boolean }, persists the flip + stamps the
 *          went_online_at timestamp when transitioning offline → online.
 *
 * Only activated, non-deactivated drivers are allowed to flip the
 * flag. A pending / rejected driver has no business broadcasting GPS,
 * so we 403 them rather than silently no-op.
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
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("is_online, went_online_at, activated, deactivated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    online: !!driver.is_online,
    wentOnlineAt: driver.went_online_at ?? null,
  });
}

type PatchBody = { online?: unknown };

export async function PATCH(request: Request) {
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

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  if (typeof body.online !== "boolean") {
    return NextResponse.json(
      { error: "online must be a boolean" },
      { status: 400 },
    );
  }
  const desired = body.online;

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, is_online, activated, deactivated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!driver.activated || driver.deactivated_at) {
    return NextResponse.json(
      { error: "Your driver account isn't currently active" },
      { status: 403 },
    );
  }

  // Push-subscription gate: a driver going online MUST have at least
  // one active web-push subscription on file. Without it they'd never
  // get the wake-up notification when a rider hails — they'd have to
  // sit on the page staring at it, which defeats the point of being
  // "online but not eyes-on-screen".
  //
  // The UI also enforces this client-side (DriverReadinessGate), but
  // the server is the source of truth — a tampered or stale client
  // can't sneak past.
  //
  // Only enforced on the offline→online flip. Going OFFLINE is always
  // allowed regardless (a driver should never be trapped online).
  if (desired) {
    const { count: pushCount } = await supabase
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (!pushCount || pushCount === 0) {
      return NextResponse.json(
        {
          error: "push_required",
          message:
            "Enable push notifications before going online — riders' hails won't reach you otherwise.",
        },
        { status: 412 },
      );
    }
  }

  // Stamp went_online_at only on the offline → online transition. We
  // don't bump it on every PATCH so the "online for X minutes" timer
  // stays anchored to the actual session start.
  const update: Record<string, unknown> = { is_online: desired };
  if (desired && !driver.is_online) {
    update.went_online_at = new Date().toISOString();
  }
  if (!desired) {
    // Going offline — clear the timestamp so we don't show a stale
    // "online since…" if the driver never returns this session.
    update.went_online_at = null;
  }

  const { error } = await supabase
    .from("drivers")
    .update(update)
    .eq("id", driver.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    online: desired,
    wentOnlineAt:
      typeof update.went_online_at === "string"
        ? update.went_online_at
        : null,
  });
}
