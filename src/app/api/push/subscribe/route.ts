import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * POST /api/push/subscribe
 *
 * Stores a browser PushSubscription so the server can deliver pushes
 * to this device later. Idempotent — the unique index on
 * (user_id, endpoint) means re-subscribing from the same browser
 * just updates the existing row.
 *
 * Body: PushSubscription.toJSON() shape:
 *   { endpoint, keys: { p256dh, auth } }
 */

type SubBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
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
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh =
    body.keys && typeof body.keys.p256dh === "string" ? body.keys.p256dh : "";
  const authKey =
    body.keys && typeof body.keys.auth === "string" ? body.keys.auth : "";

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json(
      { error: "Subscription must include endpoint + p256dh + auth keys." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const userAgent = request.headers.get("user-agent");

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth: authKey,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
