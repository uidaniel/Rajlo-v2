import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "./supabase-server";

/**
 * Server-side web push delivery.
 *
 * Reads VAPID config from env at request time. Without it set, every
 * `pushTo*` helper short-circuits as `{ ok:false, skipped:true }` so
 * dev keeps working without VAPID keys.
 *
 * Env vars (set in `.env.local`, see scripts/generate-vapid.mjs to
 * generate fresh keys):
 *   VAPID_PUBLIC_KEY      — base64url public key (also exposed via
 *                           NEXT_PUBLIC_VAPID_PUBLIC_KEY for the
 *                           browser to use as applicationServerKey)
 *   VAPID_PRIVATE_KEY     — base64url private key (server only!)
 *   VAPID_SUBJECT         — `mailto:` URL for push providers to
 *                           reach out if anything's wrong with
 *                           our deliveries (default ops@rajlo.com)
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Deep-link target opened on click. Defaults to "/". */
  url?: string;
  /** Tag for dedup — newer push with the same tag replaces older. */
  tag?: string;
  /** Re-buzz even if a same-tag notification is already showing. */
  renotify?: boolean;
  /** Hero image inside the notification (Android, Chrome). */
  image?: string;
  /** Small icon (192x192). Defaults to brand mark. */
  icon?: string;
  /** Monochrome silhouette for Android tray. Defaults to brand mark. */
  badge?: string;
  /** Up to 2 buttons. Each `action` value is sent on click. */
  actions?: Array<{ action: string; title: string }>;
  /** Keeps the notification on screen until dismissed (Chrome desktop). */
  requireInteraction?: boolean;
  /** Vibration pattern (Android). */
  vibrate?: number[];
  /** Arbitrary payload routed back via the `notificationclick` event. */
  data?: Record<string, unknown>;
};

type SendResult =
  | { ok: true; sent: number; pruned: number }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; error: string };

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:ops@rajlo.com",
    pub,
    priv,
  );
  configured = true;
  return true;
}

/**
 * Send a push to every subscription for the given user. Best-effort —
 * failed sub-ids get pruned automatically (404/410 from the push
 * service means the subscription is dead).
 *
 * Caller passes a Supabase service-role client. We never trust an auth
 * client here because deletion of dead subs needs to bypass RLS.
 */
export async function pushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<SendResult> {
  if (!ensureConfigured()) {
    return {
      ok: false,
      skipped: true,
      reason: "VAPID keys not set — push disabled in dev",
    };
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!subs || subs.length === 0) {
    return { ok: true, sent: 0, pruned: 0 };
  }

  const body = JSON.stringify(serialize(payload));
  let sent = 0;
  const deadIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
        );
        sent += 1;
      } catch (err) {
        // 404 (NotFound) or 410 (Gone) means the subscription is dead.
        // Prune it so we don't keep retrying on every event.
        const status =
          (err as { statusCode?: number } | null)?.statusCode ?? 0;
        if (status === 404 || status === 410) {
          deadIds.push(s.id);
        }
      }
    }),
  );

  if (deadIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", deadIds);
  }

  // Touch last_seen for surviving subs — used later for pruning very
  // old never-seen subscriptions in a maintenance job.
  if (sent > 0) {
    const aliveIds = subs.map((s) => s.id).filter((id) => !deadIds.includes(id));
    if (aliveIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ last_seen_at: new Date().toISOString() })
        .in("id", aliveIds);
    }
  }

  return { ok: true, sent, pruned: deadIds.length };
}

/**
 * Convenience wrapper — uses the service-role client itself so callers
 * who already have one can pass it, but if they don't we make one.
 */
export async function pushToUserById(
  userId: string,
  payload: PushPayload,
): Promise<SendResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      skipped: true,
      reason: "Service role not configured",
    };
  }
  return pushToUser(supabase, userId, payload);
}

/** Filter the payload to the keys the service worker expects, dropping
 *  anything undefined so the wire payload stays small. */
function serialize(p: PushPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: p.title,
    body: p.body,
  };
  if (p.url) out.url = p.url;
  if (p.tag) out.tag = p.tag;
  if (p.renotify) out.renotify = true;
  if (p.image) out.image = p.image;
  if (p.icon) out.icon = p.icon;
  if (p.badge) out.badge = p.badge;
  if (p.actions && p.actions.length > 0) out.actions = p.actions;
  if (p.requireInteraction) out.requireInteraction = true;
  if (p.vibrate) out.vibrate = p.vibrate;
  if (p.data) out.data = p.data;
  return out;
}

/** Public VAPID key for browser-side `applicationServerKey`. Returns
 *  null if not configured — callers should bail gracefully. */
export function getPublicVapidKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}
