-- ============================================================================
-- Rajlo — Route Taxi hail chat (driver ↔ rider during a hail)
--
-- Mirrors the existing `ride_messages` table but for Mode B. Kept as a
-- separate table so route-hail and ride conversations stay cleanly
-- partitioned (different tables, different RLS, no polymorphic key
-- to break later).
--
-- Security model:
--   While a hail is `accepted` or `picked_up`, the rider AND the
--   driver attached to the hail's session can read + send messages.
--   Once the hail flips to `completed`, `cancelled`, or `no_show`,
--   the conversation drops out of both participants' RLS views —
--   only admins (profiles.role = 'admin') retain read access for
--   safety + dispute review.
--
-- MVP scope: text messages only. Image / voice can land later by
-- mirroring the `kind` column from `ride_messages` and adding a
-- bucket policy.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.route_hail_messages (
  id uuid primary key default gen_random_uuid(),
  hail_id uuid not null references public.route_hails(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('rider', 'driver')),
  body text not null check (length(body) <= 2000),
  -- Future "delivered/read" UX. NULL until the OTHER role views it.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_route_hail_messages_hail_created
  on public.route_hail_messages(hail_id, created_at);

create index if not exists idx_route_hail_messages_unread
  on public.route_hail_messages(hail_id, sender_role)
  where read_at is null;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.route_hail_messages enable row level security;

-- Rider reads messages on their own hail, while it's still in flight.
drop policy if exists "Rider reads own hail messages" on public.route_hail_messages;
create policy "Rider reads own hail messages"
  on public.route_hail_messages for select
  using (
    exists (
      select 1 from public.route_hails h
       where h.id = route_hail_messages.hail_id
         and h.rider_id = auth.uid()
         and h.status in ('accepted', 'picked_up')
    )
  );

-- Rider sends as themselves, on their own hail, while it's in flight.
drop policy if exists "Rider sends own hail messages" on public.route_hail_messages;
create policy "Rider sends own hail messages"
  on public.route_hail_messages for insert
  with check (
    sender_id = auth.uid()
    and sender_role = 'rider'
    and exists (
      select 1 from public.route_hails h
       where h.id = route_hail_messages.hail_id
         and h.rider_id = auth.uid()
         and h.status in ('accepted', 'picked_up')
    )
  );

-- Driver reads messages on hails attached to their active session,
-- while the hail is still in flight.
drop policy if exists "Driver reads assigned hail messages" on public.route_hail_messages;
create policy "Driver reads assigned hail messages"
  on public.route_hail_messages for select
  using (
    exists (
      select 1
        from public.route_hails h
        join public.driver_sessions s on s.id = h.session_id
        join public.drivers d on d.id = s.driver_id
       where h.id = route_hail_messages.hail_id
         and d.user_id = auth.uid()
         and h.status in ('accepted', 'picked_up')
    )
  );

-- Driver sends as themselves on their assigned hail.
drop policy if exists "Driver sends assigned hail messages" on public.route_hail_messages;
create policy "Driver sends assigned hail messages"
  on public.route_hail_messages for insert
  with check (
    sender_id = auth.uid()
    and sender_role = 'driver'
    and exists (
      select 1
        from public.route_hails h
        join public.driver_sessions s on s.id = h.session_id
        join public.drivers d on d.id = s.driver_id
       where h.id = route_hail_messages.hail_id
         and d.user_id = auth.uid()
         and h.status in ('accepted', 'picked_up')
    )
  );

-- Either side can mark the OTHER role's messages as read. Senders
-- never flip their own rows.
drop policy if exists "Participants mark counterpart messages read" on public.route_hail_messages;
create policy "Participants mark counterpart messages read"
  on public.route_hail_messages for update
  using (
    exists (
      select 1 from public.route_hails h
       where h.id = route_hail_messages.hail_id
         and (
           h.rider_id = auth.uid()
           or exists (
             select 1
               from public.driver_sessions s
               join public.drivers d on d.id = s.driver_id
              where s.id = h.session_id and d.user_id = auth.uid()
           )
         )
    )
  )
  with check (true);

-- Admins see everything for support / dispute review.
drop policy if exists "Admins read all hail messages" on public.route_hail_messages;
create policy "Admins read all hail messages"
  on public.route_hail_messages for select
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    )
  );
