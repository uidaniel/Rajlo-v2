import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { pushToUserById } from "@/lib/push";

/**
 * POST /api/push/test
 *
 * Sends a "Push notifications are working!" notification to every
 * device the calling user has subscribed. Used by the rider settings
 * page so the user can verify their setup before relying on it.
 *
 * Returns { ok, sent, pruned } so the UI can surface "delivered to N
 * devices" / "no devices subscribed yet".
 */
export async function POST() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await pushToUserById(user.id, {
    title: "Push notifications are on!",
    body: "You'll get pings the moment your driver matches, arrives, and finishes the trip. Let's go!",
    url: "/rider",
    tag: "rajlo-test",
    icon: "/rajlo%20favicon.png",
    badge: "/rajlo%20favicon.png",
    requireInteraction: false,
  });

  return NextResponse.json(result);
}
