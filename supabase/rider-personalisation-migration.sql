-- ============================================================================
-- Rajlo Phase 2A — Rider personalisation
-- Run AFTER auth-migration.sql.
--
-- Three tables that back the rider portal's user-facing preferences:
--
--   rider_notifications  — inbox feed (one row per notification)
--   rider_preferences    — single-row settings doc keyed by user_id
--   trusted_contacts     — emergency / share-trip targets
--
-- All three are owned by the rider; RLS only lets the user see/edit
-- their own rows. service_role bypasses RLS for fan-out (server-side
-- writes from the trip pipeline).
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. rider_notifications ----------
create table if not exists public.rider_notifications (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references auth.users(id) on delete cascade,
  -- Drives icon + colour grouping in the inbox UI.
  kind text not null
    check (kind in ('trip', 'promo', 'system', 'safety')),
  title text not null,
  body text not null,
  -- Optional deep-link target + CTA copy for the inline button.
  href text,
  cta text,
  -- Null = unread. Populated when the rider opens / dismisses the entry.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_rider_notifications_rider_unread
  on public.rider_notifications(rider_id, created_at desc)
  where read_at is null;

create index if not exists idx_rider_notifications_rider_all
  on public.rider_notifications(rider_id, created_at desc);

-- ---------- 2. rider_preferences ----------
-- One row per rider. user_id is the PK so an upsert from the API stays
-- a one-shot operation.
create table if not exists public.rider_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Push notification toggles
  push_enabled boolean not null default true,
  push_trip_updates boolean not null default true,
  push_driver_arrival boolean not null default true,
  push_promos boolean not null default false,
  push_safety_tips boolean not null default true,

  -- Locale / theme
  language text not null default 'en' check (language in ('en', 'patois')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),

  -- Safety auto-share defaults — what happens automatically every trip.
  auto_share_enabled boolean not null default false,
  auto_share_notify_arrival boolean not null default true,
  auto_share_notify_delay boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_rider_preferences_updated_at on public.rider_preferences;
create trigger trg_rider_preferences_updated_at
  before update on public.rider_preferences
  for each row execute function public.set_updated_at();

-- ---------- 3. trusted_contacts ----------
create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  phone text not null check (length(phone) between 6 and 30),
  relationship text not null default 'Family',
  created_at timestamptz not null default now()
);

create index if not exists idx_trusted_contacts_rider
  on public.trusted_contacts(rider_id, created_at desc);

-- Hard cap at 5 contacts per rider — keeps the share-trip SMS
-- batch tractable + matches what the UI advertises. Enforced via
-- trigger because PostgreSQL doesn't let CHECK constraints reach
-- across rows, and a partial UNIQUE wouldn't express "max 5".
create or replace function public.enforce_trusted_contacts_cap()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.trusted_contacts where rider_id = new.rider_id
  ) >= 5 then
    raise exception 'You can have at most 5 trusted contacts.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trusted_contacts_cap on public.trusted_contacts;
create trigger trg_trusted_contacts_cap
  before insert on public.trusted_contacts
  for each row execute function public.enforce_trusted_contacts_cap();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.rider_notifications enable row level security;
alter table public.rider_preferences   enable row level security;
alter table public.trusted_contacts    enable row level security;

-- ----- rider_notifications -----
drop policy if exists "Rider sees own notifications" on public.rider_notifications;
create policy "Rider sees own notifications"
  on public.rider_notifications for select
  using (rider_id = auth.uid());

drop policy if exists "Rider updates own notifications" on public.rider_notifications;
create policy "Rider updates own notifications"
  on public.rider_notifications for update
  using (rider_id = auth.uid())
  with check (rider_id = auth.uid());

-- service_role inserts via the trip pipeline.

-- ----- rider_preferences -----
drop policy if exists "Rider sees own preferences" on public.rider_preferences;
create policy "Rider sees own preferences"
  on public.rider_preferences for select
  using (user_id = auth.uid());

drop policy if exists "Rider creates own preferences" on public.rider_preferences;
create policy "Rider creates own preferences"
  on public.rider_preferences for insert
  with check (user_id = auth.uid());

drop policy if exists "Rider updates own preferences" on public.rider_preferences;
create policy "Rider updates own preferences"
  on public.rider_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----- trusted_contacts -----
drop policy if exists "Rider sees own contacts" on public.trusted_contacts;
create policy "Rider sees own contacts"
  on public.trusted_contacts for select
  using (rider_id = auth.uid());

drop policy if exists "Rider creates own contacts" on public.trusted_contacts;
create policy "Rider creates own contacts"
  on public.trusted_contacts for insert
  with check (rider_id = auth.uid());

drop policy if exists "Rider deletes own contacts" on public.trusted_contacts;
create policy "Rider deletes own contacts"
  on public.trusted_contacts for delete
  using (rider_id = auth.uid());

-- ============================================================================
-- Realtime — let clients see notifications appear without refresh.
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rider_notifications;
  end if;
exception
  when duplicate_object then null;
end $$;
