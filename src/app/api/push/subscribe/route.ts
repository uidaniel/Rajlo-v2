import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * POST /api/push/subscribe
 *
 * Stores a push subscription so the server can deliver pushes to this
 * device later. Two shapes are accepted, distinguished by the
 * `platform` field:
 *
 *   Web (the original):
 *     { endpoint, keys: { p256dh, auth } }
 *
 *   Native (Capacitor — FCM on Android, APNs on iOS):
 *     { platform: 'android' | 'ios', token }
 *
 * Idempotent on (user_id, endpoint). For native we synthesise an
 * endpoint of `fcm://<token>` (or `apns://<token>`) so the unique
 * constraint still gives us one row per device.
 */

type SubBody = {
  /** Web push fields */
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  /** Native fields */
  platform?: unknown;
  token?: unknown;
};

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SubBody;

  // Branch on shape. Native registrations carry `platform`; web
  // registrations carry `endpoint` + `keys`.
  const platformField = body.platform;
  const isNative =
    platformField === "android" || platformField === "ios";

  let row: {
    user_id: string;
    endpoint: string;
    p256dh: string | null;
    auth: string | null;
    platform: "web" | "android" | "ios";
    native_token: string | null;
    user_agent: string | null;
    last_seen_at: string;
  };

  if (isNative) {
    const platform = platformField as "android" | "ios";
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) {
      return NextResponse.json(
        { error: "Native subscription must include a token." },
        { status: 400 },
      );
    }
    row = {
      user_id: user.id,
      // Synthetic endpoint keeps the (user_id, endpoint) unique index
      // working — one row per device, replaces itself on re-register.
      endpoint: `${platform === "ios" ? "apns" : "fcm"}://${token}`,
      p256dh: null,
      auth: null,
      platform,
      native_token: token,
      user_agent: request.headers.get("user-agent"),
      last_seen_at: new Date().toISOString(),
    };
  } else {
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const p256dh =
      body.keys && typeof body.keys.p256dh === "string"
        ? body.keys.p256dh
        : "";
    const authKey =
      body.keys && typeof body.keys.auth === "string"
        ? body.keys.auth
        : "";
    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json(
        { error: "Subscription must include endpoint + p256dh + auth keys." },
        { status: 400 },
      );
    }
    row = {
      user_id: user.id,
      endpoint,
      p256dh,
      auth: authKey,
      platform: "web",
      native_token: null,
      user_agent: request.headers.get("user-agent"),
      last_seen_at: new Date().toISOString(),
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(row, { onConflict: "user_id,endpoint" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
