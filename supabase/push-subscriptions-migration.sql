-- ============================================================================
-- Rajlo — Web Push subscriptions
--
-- Stores browser PushSubscription objects per user so the server can
-- deliver web-push notifications. One row per (user_id, endpoint) — a
-- single user can have multiple devices subscribed (phone, laptop,
-- tablet) and we want to fan-out to all of them.
--
-- The endpoint is the unique identifier from the browser's push service
-- (Firebase, Mozilla AutoPush, Apple WebPush, etc.). We never make
-- assumptions about its format — just store it.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The push service endpoint URL (unique per device).
  endpoint text not null,

  -- VAPID-ECDH keys returned by the browser's PushSubscription.toJSON().
  -- We never decrypt anything here — these are passed straight to the
  -- web-push library's send() which encrypts the payload before delivery.
  p256dh text not null,
  auth text not null,

  -- Coarse hint at where this subscription lives so we can show
  -- "iPhone · Chrome", "MacBook · Safari" etc. in a future "Devices" UI.
  user_agent text,

  -- Updated whenever we successfully send a push (so we can prune dead
  -- subs that haven't received in months) OR whenever the browser
  -- re-registers (some browsers rotate keys).
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Per-user, per-endpoint uniqueness so the same browser re-registering
-- updates the existing row instead of duplicating.
create unique index if not exists idx_push_subscriptions_user_endpoint
  on public.push_subscriptions(user_id, endpoint);

-- Common lookup pattern: "give me every active subscription for a user"
create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions(user_id);

-- RLS: users can only read/manage their own subscriptions. Service-role
-- (used by the server send routine) bypasses RLS automatically.
alter table public.push_subscriptions enable row level security;

drop policy if exists "User reads own push subs" on public.push_subscriptions;
create policy "User reads own push subs"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "User inserts own push subs" on public.push_subscriptions;
create policy "User inserts own push subs"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "User deletes own push subs" on public.push_subscriptions;
create policy "User deletes own push subs"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
