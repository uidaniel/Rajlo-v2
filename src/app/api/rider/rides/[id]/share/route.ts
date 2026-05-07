import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/rider/rides/[id]/share
 *
 * Generates a one-off public-read token the rider can text to a friend.
 * The friend opens /trip/<token> and watches the trip live without
 * needing a Rajlo account. The token is the only auth — keep the URL
 * private; only the rider has it until they choose to share.
 *
 * Body: { recipientLabel?: string }   // e.g. "Mom"
 *
 * Response: { token, url }
 */
type ShareRequest = { recipientLabel?: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as ShareRequest;

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

  // Verify the rider owns this ride.
  const { data: ride } = await supabase
    .from("rides")
    .select("id, rider_id")
    .eq("id", id)
    .eq("rider_id", user.id)
    .maybeSingle();
  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  // 32-byte token, URL-safe base64. Long enough that brute-force is
  // implausible; short enough to fit in a text message URL.
  const token = generateUrlSafeToken();

  const { error: insertError } = await supabase
    .from("trip_share_links")
    .insert({
      token,
      ride_id: ride.id,
      rider_id: user.id,
      recipient_label: body.recipientLabel?.trim() || null,
    });

  if (insertError) {
    return NextResponse.json(
      { error: `Couldn't create share link: ${insertError.message}` },
      { status: 500 },
    );
  }

  const origin =
    request.headers.get("x-forwarded-proto") &&
    request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
      : new URL(request.url).origin;

  return NextResponse.json({
    token,
    url: `${origin}/trip/${token}`,
  });
}

function generateUrlSafeToken(): string {
  const bytes = new Uint8Array(32);
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback — should never happen on Vercel/Node 18+
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Base64url encode without padding.
  let s = "";
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
