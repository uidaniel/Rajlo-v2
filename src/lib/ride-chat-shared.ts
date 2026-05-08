import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared helpers for the ride-chat endpoints.
 *
 * The auth/role gating is RLS-based — these helpers just normalise the
 * shape we return to the client + sign storage URLs for media. Any
 * "can this user see this ride" check is enforced by the policies in
 * `ride-chat-migration.sql`.
 */

export type ChatRole = "rider" | "driver" | "admin";
export type ChatKind = "text" | "image" | "voice";

export type ChatMessage = {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: "rider" | "driver";
  kind: ChatKind;
  /** For text: the body. For image / voice: a short-lived signed URL. */
  body: string;
  durationMs: number | null;
  readAt: string | null;
  createdAt: string;
};

const SIGNED_URL_TTL_S = 60 * 60 * 8; // 8 hours — well past trip duration
const CHAT_BUCKET = "ride-chat";

/**
 * Build the response-shape message list. For text messages we pass the
 * body through; for image/voice we resolve the storage path into a
 * short-lived signed URL the client can `<img src>` / `<audio src>`.
 *
 * Signed URLs expire — clients re-fetch this list on Realtime push, so
 * a stale URL just means the next push refreshes it.
 */
export async function shapeMessages(
  supabase: SupabaseClient,
  rows: Array<{
    id: string;
    ride_id: string;
    sender_id: string;
    sender_role: "rider" | "driver";
    kind: ChatKind;
    body: string;
    duration_ms: number | null;
    read_at: string | null;
    created_at: string;
  }>,
): Promise<ChatMessage[]> {
  // Bulk-sign the media paths in one round-trip rather than awaiting
  // each one serially. createSignedUrls accepts an array of paths.
  const mediaRows = rows.filter(
    (r) => r.kind === "image" || r.kind === "voice",
  );
  const pathToSignedUrl = new Map<string, string>();

  if (mediaRows.length > 0) {
    const paths = Array.from(new Set(mediaRows.map((r) => r.body)));
    const { data: signed } = await supabase.storage
      .from(CHAT_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_S);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) {
        pathToSignedUrl.set(entry.path, entry.signedUrl);
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    rideId: r.ride_id,
    senderId: r.sender_id,
    senderRole: r.sender_role,
    kind: r.kind,
    body:
      r.kind === "text"
        ? r.body
        : pathToSignedUrl.get(r.body) ?? "",
    durationMs: r.duration_ms,
    readAt: r.read_at,
    createdAt: r.created_at,
  }));
}

export const RIDE_CHAT_BUCKET = CHAT_BUCKET;
