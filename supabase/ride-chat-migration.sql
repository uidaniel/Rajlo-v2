-- ============================================================================
-- Rajlo — Ride chat (driver ↔ rider during a trip)
--
-- What this adds:
--   1. public.ride_messages           — text / image / voice messages tied
--                                        to a ride
--   2. storage bucket `ride-chat`     — private, holds image + voice blobs
--   3. RLS                             — strict "active ride only" rule for
--                                        participants; admins can always read
--
-- Security model (the load-bearing detail):
--   While a ride is in flight (status in requested/accepted/arrived/
--   in_progress), the assigned rider AND assigned driver can read +
--   send messages. The MOMENT the ride flips to completed or cancelled,
--   the conversation drops out of both participants' visibility — only
--   admins (profiles.role = 'admin') retain access for safety review +
--   dispute audits. RLS enforces this so even a leaked direct DB call
--   can't read a closed conversation.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1. ride_messages table
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.ride_messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('rider', 'driver')),
  kind text not null check (kind in ('text', 'image', 'voice')),
  -- For text: the message body. For image / voice: the storage path
  -- (key inside the `ride-chat` bucket). UI distinguishes by `kind`.
  body text not null,
  -- Voice notes carry a duration so the player can show the length
  -- without having to load the file. Null for text + image.
  duration_ms integer,
  -- Future "delivered/read" UX. Null = unread by recipient. We don't
  -- mark senders' own rows as read — only the OTHER role flips it.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ride_messages_ride_created
  on public.ride_messages(ride_id, created_at);

create index if not exists idx_ride_messages_unread
  on public.ride_messages(ride_id, sender_role)
  where read_at is null;

-- ──────────────────────────────────────────────────────────────────────
-- 2. RLS — read/write while ride is active, admin-only after
-- ──────────────────────────────────────────────────────────────────────
alter table public.ride_messages enable row level security;

-- Helper: returns true when the calling auth user is an admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: returns true when the calling auth user is a participant of
-- the given ride AND the ride is still active.
create or replace function public.is_active_ride_participant(p_ride_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rides r
    left join public.drivers d on d.id = r.driver_id
    where r.id = p_ride_id
      and r.status in ('requested', 'accepted', 'arrived', 'in_progress')
      and (
        r.rider_id = auth.uid()      -- rider on this ride
        or d.user_id = auth.uid()    -- driver assigned to this ride
      )
  );
$$;

drop policy if exists "Participants read own active-ride messages" on public.ride_messages;
create policy "Participants read own active-ride messages"
  on public.ride_messages for select
  using (
    public.is_active_ride_participant(ride_id)
    or public.is_admin()
  );

drop policy if exists "Participants send messages on active rides" on public.ride_messages;
create policy "Participants send messages on active rides"
  on public.ride_messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_active_ride_participant(ride_id)
  );

drop policy if exists "Participants mark unread messages read" on public.ride_messages;
create policy "Participants mark unread messages read"
  on public.ride_messages for update
  using (
    public.is_active_ride_participant(ride_id)
    or public.is_admin()
  )
  with check (
    public.is_active_ride_participant(ride_id)
    or public.is_admin()
  );

-- Realtime stream — the chat sheet subscribes to postgres_changes on
-- this table so messages land instantly. RLS gates per-row visibility
-- on the stream same way as SELECT, so a driver can't eavesdrop on
-- another rider's conversation even if they craft a clever filter.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and
     not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'ride_messages'
     ) then
    alter publication supabase_realtime add table public.ride_messages;
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────
-- 3. Storage bucket for image + voice blobs
-- ──────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('ride-chat', 'ride-chat', false)
on conflict (id) do nothing;

-- Path convention: <ride_id>/<random>.<ext>
-- This lets the storage policies scope by foldername(name)[1] = ride_id.

drop policy if exists "Participants upload to active ride chat" on storage.objects;
create policy "Participants upload to active ride chat"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ride-chat'
    and public.is_active_ride_participant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Participants read active ride chat media" on storage.objects;
create policy "Participants read active ride chat media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'ride-chat'
    and (
      public.is_active_ride_participant(((storage.foldername(name))[1])::uuid)
      or public.is_admin()
    )
  );

-- No DELETE / UPDATE policies — chat media is immutable once sent. Even
-- the sender can't revoke/edit. Service-role can clean up post-retention
-- if/when we add a retention policy. Admins can read indefinitely.
