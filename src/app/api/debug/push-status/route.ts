import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { pushToUser } from "@/lib/push";

/**
 * GET  /api/debug/push-status
 *   Returns a diagnostic snapshot of the calling user's push setup so
 *   you can pinpoint why a push didn't arrive. Safe to call from a
 *   signed-in browser tab or the native app.
 *
 * POST /api/debug/push-status
 *   Fires a test push to the calling user. Use this to confirm
 *   end-to-end delivery without needing a second device to trigger
 *   a real event.
 *
 * Both routes require auth. Doesn't expose anything someone couldn't
 * already see about their own account.
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

  // Env var check — without these the FCM fan-out silently no-ops.
  const envCheck = {
    FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
    VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
  };

  // Try initialising Firebase to confirm the env vars actually
  // produce a valid app (typos in the private key get caught here).
  const firebaseApp = await getFirebaseAdmin().catch(() => null);
  const firebaseReady = !!firebaseApp;

  const supabase = getSupabaseServerClient();
  let subscriptions: Array<{
    platform: string;
    has_native_token: boolean;
    has_web_keys: boolean;
    last_seen_at: string | null;
    user_agent: string | null;
  }> = [];

  if (supabase) {
    const { data } = await supabase
      .from("push_subscriptions")
      .select("platform, native_token, p256dh, auth, last_seen_at, user_agent")
      .eq("user_id", user.id);
    subscriptions = (data ?? []).map((row) => ({
      platform: (row.platform as string | null) ?? "web",
      has_native_token: !!row.native_token,
      has_web_keys: !!(row.p256dh && row.auth),
      last_seen_at: (row.last_seen_at as string | null) ?? null,
      user_agent: (row.user_agent as string | null) ?? null,
    }));
  }

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    envVarsSet: envCheck,
    firebaseAdminInitialised: firebaseReady,
    subscriptions,
    /** Per-subscription summary that mirrors how the fan-out filters them. */
    summary: {
      webSubscriptions: subscriptions.filter((s) => s.platform === "web").length,
      androidSubscriptions: subscriptions.filter((s) => s.platform === "android").length,
      iosSubscriptions: subscriptions.filter((s) => s.platform === "ios").length,
    },
  });
}

export async function POST() {
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
      { error: "service_role_missing" },
      { status: 500 },
    );
  }

  const result = await pushToUser(supabase, user.id, {
    title: "Rajlo push test",
    body: "If you see this on your phone, push delivery works.",
    tag: "debug-test",
    renotify: true,
  });

  return NextResponse.json({ ok: true, result });
}
