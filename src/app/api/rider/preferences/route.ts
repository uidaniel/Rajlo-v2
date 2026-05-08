import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET / PATCH /api/rider/preferences
 *
 * Single-row settings document keyed by user_id. The settings page
 * loads via GET and saves via PATCH (partial updates — any subset of
 * fields is fine).
 *
 * If the rider has never opened settings, the row doesn't exist yet.
 * GET returns the documented defaults in that case so the UI can
 * still render meaningful values; PATCH does an upsert so the first
 * save creates the row.
 */

/** Schema-aligned defaults — match the DB defaults so a freshly-created
 *  user sees the same UI as someone with a real row. */
const DEFAULTS = {
  push_enabled: true,
  push_trip_updates: true,
  push_driver_arrival: true,
  push_promos: false,
  push_safety_tips: true,
  language: "en" as const,
  theme: "system" as const,
  auto_share_enabled: false,
  auto_share_notify_arrival: true,
  auto_share_notify_delay: true,
};

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

  const { data } = await supabase
    .from("rider_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Either the loaded row OR documented defaults — same shape so the
  // client can treat them interchangeably.
  return NextResponse.json({ preferences: data ?? DEFAULTS });
}

type PatchBody = Partial<{
  pushEnabled: boolean;
  pushTripUpdates: boolean;
  pushDriverArrival: boolean;
  pushPromos: boolean;
  pushSafetyTips: boolean;
  language: "en" | "patois";
  theme: "system" | "light" | "dark";
  autoShareEnabled: boolean;
  autoShareNotifyArrival: boolean;
  autoShareNotifyDelay: boolean;
}>;

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

  // Map camelCase wire format → snake_case columns. Skipped fields
  // are left untouched. Unknown keys are dropped silently.
  const update: Record<string, unknown> = {};
  if (typeof body.pushEnabled === "boolean") update.push_enabled = body.pushEnabled;
  if (typeof body.pushTripUpdates === "boolean") update.push_trip_updates = body.pushTripUpdates;
  if (typeof body.pushDriverArrival === "boolean") update.push_driver_arrival = body.pushDriverArrival;
  if (typeof body.pushPromos === "boolean") update.push_promos = body.pushPromos;
  if (typeof body.pushSafetyTips === "boolean") update.push_safety_tips = body.pushSafetyTips;
  if (body.language === "en" || body.language === "patois") update.language = body.language;
  if (body.theme === "system" || body.theme === "light" || body.theme === "dark") update.theme = body.theme;
  if (typeof body.autoShareEnabled === "boolean") update.auto_share_enabled = body.autoShareEnabled;
  if (typeof body.autoShareNotifyArrival === "boolean") update.auto_share_notify_arrival = body.autoShareNotifyArrival;
  if (typeof body.autoShareNotifyDelay === "boolean") update.auto_share_notify_delay = body.autoShareNotifyDelay;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  // upsert keyed on user_id — first save creates the row, every
  // subsequent save overwrites only the fields we sent.
  const { error } = await supabase
    .from("rider_preferences")
    .upsert(
      { user_id: user.id, ...update },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
