import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * /api/route-taxi/hails/[id]/messages
 *
 * Shared chat endpoint for rider ↔ driver during a route taxi hail.
 * Either role calls the same URL — RLS on `route_hail_messages` is
 * the gate that decides who can see + send what (only the assigned
 * pair, only while the hail is in flight).
 *
 * GET    — list all messages on the hail, oldest first. Also flips
 *          unread messages from the OTHER role to "read" — saves the
 *          UI a separate POST.
 * POST   — send a text message. Caller's role is inferred from
 *          whether they own the hail (rider) or own the session it's
 *          attached to (driver).
 */

type Message = {
  id: string;
  hailId: string;
  senderId: string;
  senderRole: "rider" | "driver";
  body: string;
  readAt: string | null;
  createdAt: string;
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
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

  const role = await resolveParticipantRole(supabase, id, user.id);
  if (!role) {
    return NextResponse.json(
      { error: "Not a participant on this hail." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("route_hail_messages")
    .select("id, hail_id, sender_id, sender_role, body, read_at, created_at")
    .eq("hail_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flip unread messages FROM the other role to "read" so the
  // sender can see the read receipt next time they poll. Best-effort.
  const otherRole = role === "rider" ? "driver" : "rider";
  await supabase
    .from("route_hail_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("hail_id", id)
    .eq("sender_role", otherRole)
    .is("read_at", null);

  return NextResponse.json({
    messages: (data ?? []).map(
      (m): Message => ({
        id: m.id,
        hailId: m.hail_id,
        senderId: m.sender_id,
        senderRole: m.sender_role,
        body: m.body,
        readAt: m.read_at,
        createdAt: m.created_at,
      }),
    ),
    role,
  });
}

type PostBody = { body?: unknown };

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = (await request.json().catch(() => ({}))) as PostBody;
  const body = typeof json.body === "string" ? json.body.trim() : "";
  if (!body) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }
  if (body.length > 2000) {
    return NextResponse.json(
      { error: "Message too long — keep it under 2,000 characters." },
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

  const role = await resolveParticipantRole(supabase, id, user.id);
  if (!role) {
    return NextResponse.json(
      { error: "Not a participant on this hail." },
      { status: 403 },
    );
  }

  // Verify the hail is still in a chat-eligible state. RLS would
  // also reject this insert, but we want to surface a friendlier
  // error than a generic forbidden.
  const { data: hail } = await supabase
    .from("route_hails")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!hail || (hail.status !== "accepted" && hail.status !== "picked_up")) {
    return NextResponse.json(
      {
        error:
          "Chat is only open while the trip is in flight (driver heading to you or onboard).",
      },
      { status: 409 },
    );
  }

  const { data: inserted, error } = await supabase
    .from("route_hail_messages")
    .insert({
      hail_id: id,
      sender_id: user.id,
      sender_role: role,
      body,
    })
    .select("id, hail_id, sender_id, sender_role, body, read_at, created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Send failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: {
      id: inserted.id,
      hailId: inserted.hail_id,
      senderId: inserted.sender_id,
      senderRole: inserted.sender_role,
      body: inserted.body,
      readAt: inserted.read_at,
      createdAt: inserted.created_at,
    } as Message,
  });
}

/**
 * Decide whether the caller is the hail's rider or its assigned
 * driver. Returns null when neither — the caller has no business
 * touching this thread.
 */
async function resolveParticipantRole(
  supabase: ReturnType<typeof getSupabaseServerClient> & object,
  hailId: string,
  userId: string,
): Promise<"rider" | "driver" | null> {
  const { data: hail } = await supabase
    .from("route_hails")
    .select("rider_id, session_id")
    .eq("id", hailId)
    .maybeSingle();
  if (!hail) return null;
  if (hail.rider_id === userId) return "rider";
  if (!hail.session_id) return null;
  const { data: session } = await supabase
    .from("driver_sessions")
    .select("driver_id")
    .eq("id", hail.session_id)
    .maybeSingle();
  if (!session) return null;
  const { data: driver } = await supabase
    .from("drivers")
    .select("user_id")
    .eq("id", session.driver_id)
    .maybeSingle();
  if (driver?.user_id === userId) return "driver";
  return null;
}
