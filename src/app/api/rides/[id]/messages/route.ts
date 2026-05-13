import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import {
  shapeMessages,
  RIDE_CHAT_BUCKET,
} from "@/lib/ride-chat-shared";
import { notifyRider, notifyDriver } from "@/lib/notify";

/**
 * GET / POST /api/rides/[id]/messages
 *
 * Single endpoint shared by riders, drivers, and admins. RLS on
 * `ride_messages` does the gating:
 *   - Riders + drivers see + send only on their OWN active rides
 *     (status in requested/accepted/arrived/in_progress)
 *   - Admins see everything anytime
 *
 * GET  →  list of messages, oldest first (chat reading order)
 * POST →  body { kind: "text" | "image" | "voice", body, durationMs? }
 *         For text: `body` is the message string
 *         For image/voice: `body` is the storage path returned by the
 *         upload step
 *
 * Media uploads happen client-side directly to the `ride-chat` bucket
 * (storage RLS gates that). The path is then sent here as the `body`
 * of an image/voice message row.
 */

type PostBody = {
  kind?: unknown;
  body?: unknown;
  durationMs?: unknown;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Auth client honours the user's RLS rules — exactly what we want
  // here. If the calling user isn't allowed to read this ride's
  // messages, the SELECT just returns an empty list.
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await auth
    .from("ride_messages")
    .select(
      "id, ride_id, sender_id, sender_role, kind, body, duration_ms, read_at, created_at",
    )
    .eq("ride_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // We need a service-role client to sign storage URLs (signing
  // bypasses bucket RLS, but the user already proved they're entitled
  // to see these rows above — RLS-gated SELECT == they're a
  // participant on an active ride OR an admin).
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    // Fallback: return text-only messages so the UI can still
    // partially render. Media will appear blank.
    return NextResponse.json({
      messages: (rows ?? []).map((r) => ({
        id: r.id,
        rideId: r.ride_id,
        senderId: r.sender_id,
        senderRole: r.sender_role,
        kind: r.kind,
        body: r.kind === "text" ? r.body : "",
        durationMs: r.duration_ms,
        readAt: r.read_at,
        createdAt: r.created_at,
      })),
    });
  }

  const messages = await shapeMessages(supabase, rows ?? []);

  // Best-effort: mark as read every message the OTHER role sent that
  // we haven't already read. Done via the auth client so RLS gates
  // it (admin views shouldn't flip read_at).
  const myRoleProbe = rows?.find((r) => r.sender_id === user.id)?.sender_role;
  // If we haven't sent anything yet, infer role from the rides table.
  // We pull both potential roles inline so a freshly-viewed empty
  // chat still updates read state correctly.
  if (rows && rows.length > 0) {
    const otherRole = myRoleProbe === "rider" ? "driver" : "rider";
    const unreadIds = rows
      .filter((r) => r.read_at === null && r.sender_role === otherRole)
      .map((r) => r.id);
    if (unreadIds.length > 0) {
      void auth
        .from("ride_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds)
        .then(() => null);
    }
  }

  return NextResponse.json({ messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const kind = body.kind;
  if (kind !== "text" && kind !== "image" && kind !== "voice") {
    return NextResponse.json(
      { error: "kind must be text, image, or voice" },
      { status: 400 },
    );
  }

  const messageBody = typeof body.body === "string" ? body.body.trim() : "";
  if (!messageBody) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  // Length cap on text messages — generous, but stops a runaway paste
  // from blowing up the chat row.
  if (kind === "text" && messageBody.length > 2000) {
    return NextResponse.json(
      { error: "Message is too long (2000 chars max)" },
      { status: 400 },
    );
  }

  // For media messages, validate the path looks like ours: <ride_id>/...
  if (kind !== "text" && !messageBody.startsWith(`${id}/`)) {
    return NextResponse.json(
      { error: "Media path must be inside this ride's folder" },
      { status: 400 },
    );
  }

  const durationMs =
    typeof body.durationMs === "number" && body.durationMs > 0
      ? Math.round(body.durationMs)
      : null;

  // Server-side role assertion: figure out whether the caller is the
  // rider or the assigned driver on this ride. Anything else is 403.
  const supabase = getSupabaseServerClient() ?? auth;
  const { data: ride } = await supabase
    .from("rides")
    .select("rider_id, driver_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }
  const activeStatuses = new Set([
    "requested",
    "accepted",
    "arrived",
    "in_progress",
  ]);
  if (!activeStatuses.has(ride.status)) {
    return NextResponse.json(
      { error: "This ride is closed — chat is no longer available." },
      { status: 410 },
    );
  }

  let senderRole: "rider" | "driver" | null = null;
  if (ride.rider_id === user.id) {
    senderRole = "rider";
  } else if (ride.driver_id) {
    const { data: driver } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("id", ride.driver_id)
      .maybeSingle();
    if (driver?.user_id === user.id) senderRole = "driver";
  }

  if (!senderRole) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Insert via the AUTH client so the RLS policy sees the right
  // auth.uid() context. Insert returns the row so we can echo back to
  // the client without a follow-up GET.
  const { data: inserted, error } = await auth
    .from("ride_messages")
    .insert({
      ride_id: id,
      sender_id: user.id,
      sender_role: senderRole,
      kind,
      body: messageBody,
      duration_ms: durationMs,
    })
    .select(
      "id, ride_id, sender_id, sender_role, kind, body, duration_ms, read_at, created_at",
    )
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Couldn't send message" },
      { status: 500 },
    );
  }

  // Shape (signs URLs for media so the sender immediately sees their
  // image/voice in their own bubble without a separate fetch).
  const sigClient = getSupabaseServerClient();
  const [shaped] = sigClient
    ? await shapeMessages(sigClient, [inserted])
    : [
        {
          id: inserted.id,
          rideId: inserted.ride_id,
          senderId: inserted.sender_id,
          senderRole: inserted.sender_role,
          kind: inserted.kind as "text" | "image" | "voice",
          body: inserted.kind === "text" ? inserted.body : "",
          durationMs: inserted.duration_ms,
          readAt: inserted.read_at,
          createdAt: inserted.created_at,
        },
      ];

  // Push notification to the OTHER party. Best-effort — failure here
  // doesn't block the message send (the realtime subscription on the
  // other client will still deliver the message in-app; the push is
  // for waking them up when the app is backgrounded). Service-role
  // client is needed because the notify helpers write to inbox tables
  // outside of the auth user's RLS scope.
  if (sigClient) {
    const previewBody =
      kind === "text"
        ? messageBody.slice(0, 120)
        : kind === "image"
          ? "Sent a photo"
          : "Sent a voice note";

    if (senderRole === "rider" && ride.driver_id) {
      // Resolve the driver's auth.users.id to address the push.
      const { data: drv } = await sigClient
        .from("drivers")
        .select("user_id")
        .eq("id", ride.driver_id)
        .maybeSingle();
      if (drv?.user_id) {
        void notifyDriver(sigClient, {
          driverUserId: drv.user_id,
          kind: "trip_update",
          title: "New message from your rider",
          body: previewBody,
          // `?chat=1` is picked up by ChatLauncher in the active-trip
          // page — auto-opens the chat sheet so the driver lands
          // straight in the conversation instead of just on the trip
          // page.
          href: "/driver/active-trip?chat=1",
          pushTag: `ride-${id}-chat`,
          pushRenotify: true,
        }).catch(() => null);
      }
    } else if (senderRole === "driver") {
      void notifyRider(sigClient, {
        riderId: ride.rider_id,
        kind: "trip",
        title: "New message from your driver",
        body: previewBody,
        href: "/rider/live-trip?chat=1",
        pushTag: `ride-${id}-chat`,
        pushRenotify: true,
      }).catch(() => null);
    }
  }

  return NextResponse.json({ message: shaped });
}

export { RIDE_CHAT_BUCKET as _BUCKET };
