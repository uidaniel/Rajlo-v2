import type { SupabaseClient } from "@supabase/supabase-js";
import { pushToUser, type PushPayload } from "./push";

/**
 * Unified rider notification helper — single entry point for "tell the
 * rider that X happened". Fans out into:
 *
 *   1. `rider_notifications` row → shows up in the in-app inbox
 *   2. Web push to every subscribed device → buzzes phone/laptop
 *
 * Email is intentionally NOT bundled here — emails are sent from each
 * specific event handler with rich rendered templates (`email-templates.ts`).
 * Push + inbox are real-time channels; email is async receipts.
 *
 * Honours `rider_preferences` so a rider who toggled off "trip updates"
 * stops getting trip-update pushes (the inbox row still lands — they
 * can find it later if they want, but we don't buzz the phone).
 */

export type NotifyKind = "trip" | "promo" | "system" | "safety";

type NotifyArgs = {
  riderId: string;
  /** Drives icon + colour grouping in the inbox AND the preference key
   *  used to decide whether to push. */
  kind: NotifyKind;
  title: string;
  body: string;
  /** Deep link the inbox row + the push notification opens. */
  href?: string;
  /** Optional CTA copy on the inbox row. Push notifications carry
   *  href+title automatically — `cta` is for the in-app inbox button. */
  cta?: string;
  /** Tag for push dedup (e.g. `ride-${rideId}-status`). Same tag
   *  replaces an earlier push so a rider going from "matched" to
   *  "arrived" doesn't see two stacked notifications. */
  pushTag?: string;
  /** Critical pings (driver arrived, SOS) re-buzz even if the same tag
   *  is already on screen. */
  pushRenotify?: boolean;
  /** Skip the in-app inbox row — push only. Use sparingly. */
  pushOnly?: boolean;
  /** Skip the push — inbox only. Use for subtle/non-urgent items. */
  inboxOnly?: boolean;
  /** Hero image to render inside the push (Android, Chrome). */
  pushImage?: string;
  /** Optional buttons inside the push. */
  pushActions?: Array<{ action: string; title: string }>;
};

/**
 * Notify a rider about something. Best-effort — never throws.
 * Caller must pass a service-role Supabase client (we touch
 * rider_notifications and push_subscriptions, both RLS-guarded).
 */
export async function notifyRider(
  supabase: SupabaseClient,
  args: NotifyArgs,
): Promise<void> {
  const tasks: Array<Promise<unknown>> = [];

  // 1. In-app inbox row
  if (!args.pushOnly) {
    tasks.push(
      Promise.resolve(
        supabase
          .from("rider_notifications")
          .insert({
            rider_id: args.riderId,
            kind: args.kind,
            title: args.title,
            body: args.body,
            href: args.href ?? null,
            cta: args.cta ?? null,
          }),
      )
        .then(() => null)
        .catch(() => null),
    );
  }

  // 2. Web push — gated on the rider's preferences. We resolve their
  //    prefs row inline so the caller doesn't have to.
  if (!args.inboxOnly) {
    tasks.push(
      shouldPush(supabase, args.riderId, args.kind).then(async (allow) => {
        if (!allow) return null;
        const payload: PushPayload = {
          title: args.title,
          body: args.body,
          url: args.href,
          tag: args.pushTag,
          renotify: args.pushRenotify,
          image: args.pushImage,
          actions: args.pushActions,
          requireInteraction: args.kind === "safety",
          data: { kind: args.kind, riderId: args.riderId },
        };
        return pushToUser(supabase, args.riderId, payload).catch(() => null);
      }),
    );
  }

  await Promise.all(tasks);
}

/** Decides whether to actually buzz the phone for a given kind. The
 *  inbox row always lands; this only gates push delivery. */
async function shouldPush(
  supabase: SupabaseClient,
  riderId: string,
  kind: NotifyKind,
): Promise<boolean> {
  const { data } = await supabase
    .from("rider_preferences")
    .select(
      "push_enabled, push_trip_updates, push_driver_arrival, push_promos, push_safety_tips",
    )
    .eq("user_id", riderId)
    .maybeSingle();

  // No prefs row yet — defaults are "everything on except promos" per
  // the migration default, so trip/system/safety push by default.
  if (!data) {
    return kind !== "promo";
  }

  if (!data.push_enabled) return false;

  switch (kind) {
    case "trip":
      return data.push_trip_updates;
    case "safety":
      return data.push_safety_tips;
    case "promo":
      return data.push_promos;
    case "system":
      // System notifications follow the master switch only.
      return true;
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Driver-side notifications
   ──────────────────────────────────────────────────────────────────────

   Drivers have a dedicated inbox table (`driver_notifications`) and
   share the `push_subscriptions` table with riders since both are
   keyed on `auth.users.id`. `notifyDriver()` fans out into:
     1. driver_notifications row → driver portal inbox feed
     2. Web push to every subscribed device

   Email isn't bundled here — driver-facing emails are sent from each
   specific event handler with rich rendered templates (via
   `email-templates.ts`).
*/

export type DriverNotifyKind =
  | "ride_available"
  | "trip_update"
  | "verification"
  | "vehicle_change"
  | "system";

type DriverNotifyArgs = {
  /** auth.users.id — same value as drivers.user_id. */
  driverUserId: string;
  kind: DriverNotifyKind;
  title: string;
  body: string;
  href?: string;
  /** CTA copy on the inbox row. The push notification itself doesn't
   *  use this — pushes carry title + body + click-to-href only. */
  cta?: string;
  pushTag?: string;
  pushRenotify?: boolean;
  pushActions?: Array<{ action: string; title: string }>;
  /** Critical pushes (new ride request) re-buzz even if a same-tag
   *  notification is already on screen. */
  requireInteraction?: boolean;
  /** Skip the inbox row — push only. Use sparingly. */
  pushOnly?: boolean;
  /** Skip the push — inbox only. Use for non-urgent items where the
   *  driver shouldn't be buzzed (e.g. weekly summary). */
  inboxOnly?: boolean;
};

/**
 * Notify a driver about something. Best-effort — never throws.
 */
export async function notifyDriver(
  supabase: SupabaseClient,
  args: DriverNotifyArgs,
): Promise<void> {
  const tasks: Array<Promise<unknown>> = [];

  // 1. Inbox row
  if (!args.pushOnly) {
    tasks.push(
      Promise.resolve(
        supabase.from("driver_notifications").insert({
          driver_id: args.driverUserId,
          kind: args.kind,
          title: args.title,
          body: args.body,
          href: args.href ?? null,
          cta: args.cta ?? null,
        }),
      )
        .then(() => null)
        .catch(() => null),
    );
  }

  // 2. Web push
  if (!args.inboxOnly) {
    tasks.push(
      pushToUser(supabase, args.driverUserId, {
        title: args.title,
        body: args.body,
        url: args.href,
        tag: args.pushTag,
        renotify: args.pushRenotify,
        actions: args.pushActions,
        requireInteraction:
          args.requireInteraction ?? args.kind === "ride_available",
        data: { kind: args.kind, driverUserId: args.driverUserId },
      }).catch(() => null),
    );
  }

  await Promise.all(tasks);
}

/**
 * Fan-out helper — used when a rider creates a ride and we want every
 * activated, non-deactivated driver to know. Caller passes the
 * Supabase service-role client.
 *
 * Caps at 50 drivers per call (the realistic Phase 1A pool); paging
 * is a nice-to-have for later.
 */
export async function notifyAllAvailableDrivers(
  supabase: SupabaseClient,
  args: Omit<DriverNotifyArgs, "driverUserId">,
): Promise<{ notified: number }> {
  const { data: drivers } = await supabase
    .from("drivers")
    .select("user_id")
    .eq("activated", true)
    .is("deactivated_at", null)
    .not("user_id", "is", null)
    .limit(50);

  if (!drivers || drivers.length === 0) {
    return { notified: 0 };
  }

  await Promise.all(
    drivers.map((d) =>
      d.user_id
        ? notifyDriver(supabase, { ...args, driverUserId: d.user_id })
        : null,
    ),
  );

  return { notified: drivers.length };
}

/**
 * Route-taxi fan-out — notify every driver who currently has an active
 * session on the given route. This is the "broadcast" matcher: a hail
 * pings everyone driving that corridor and the first to accept wins
 * via the atomic claim in `/api/driver/route-taxi/hails/[id]`.
 *
 * Why join through `drivers.user_id`? Sessions key on `driver_id` (the
 * drivers-table PK), but notifications + push subscriptions key on
 * the auth-user id. The join resolves that.
 *
 * Cap at 50 — Jamaica's biggest corridors might have a couple dozen
 * cars at peak; 50 is comfortable headroom without an explosion.
 */
export async function notifyRouteTaxiDrivers(
  supabase: SupabaseClient,
  routeId: string,
  args: Omit<DriverNotifyArgs, "driverUserId">,
): Promise<{ notified: number }> {
  // Two-step lookup rather than a nested PostgREST select. The nested
  // shape is awkward to type — PostgREST returns the joined table as
  // an array of unknown cardinality and the inferred type fights us.
  // Two small queries keeps the types honest and the code readable.
  const { data: sessions } = await supabase
    .from("driver_sessions")
    .select("driver_id")
    .eq("route_id", routeId)
    .eq("status", "active")
    .limit(50);

  if (!sessions || sessions.length === 0) {
    return { notified: 0 };
  }

  const driverIds = Array.from(
    new Set(
      (sessions as Array<{ driver_id: string | null }>)
        .map((s) => s.driver_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );

  if (driverIds.length === 0) return { notified: 0 };

  const { data: drivers } = await supabase
    .from("drivers")
    .select("user_id")
    .in("id", driverIds)
    .eq("activated", true)
    .is("deactivated_at", null)
    .not("user_id", "is", null);

  if (!drivers || drivers.length === 0) {
    return { notified: 0 };
  }

  const userIds = Array.from(
    new Set(
      (drivers as Array<{ user_id: string | null }>)
        .map((d) => d.user_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );

  if (userIds.length === 0) return { notified: 0 };

  await Promise.all(
    userIds.map((userId) =>
      notifyDriver(supabase, { ...args, driverUserId: userId }),
    ),
  );

  return { notified: userIds.length };
}
