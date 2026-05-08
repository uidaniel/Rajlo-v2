-- ============================================================================
-- Rajlo — Driver notifications inbox
--
-- Adds:
--   driver_notifications  — driver-side equivalent of `rider_notifications`,
--                           used to power the driver portal's inbox feed.
--
-- Differences from rider_notifications:
--   - `driver_id` references auth.users (same pattern, just a different name)
--   - `kind` enumerates driver-specific events:
--       ride_available, trip_update, verification, vehicle_change, system
--
-- Realtime is enabled so the inbox page sees rows appear without a
-- refresh — RLS scopes the stream to the calling driver.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.driver_notifications (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id) on delete cascade,
  kind text not null
    check (kind in ('ride_available', 'trip_update', 'verification', 'vehicle_change', 'system')),
  title text not null,
  body text not null,
  href text,
  cta text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_notifications_unread
  on public.driver_notifications(driver_id, created_at desc)
  where read_at is null;

create index if not exists idx_driver_notifications_all
  on public.driver_notifications(driver_id, created_at desc);

alter table public.driver_notifications enable row level security;

drop policy if exists "Driver sees own notifications" on public.driver_notifications;
create policy "Driver sees own notifications"
  on public.driver_notifications for select
  using (auth.uid() = driver_id);

drop policy if exists "Driver updates own notifications" on public.driver_notifications;
create policy "Driver updates own notifications"
  on public.driver_notifications for update
  using (auth.uid() = driver_id);

-- Service-role client bypasses RLS, so insert/delete from the server is
-- unrestricted. We don't add a policy for INSERT because there's no
-- legitimate reason for a driver to author their own inbox entries.

-- Realtime — let the driver inbox page watch for new rows live.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and
     not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'driver_notifications'
     ) then
    alter publication supabase_realtime add table public.driver_notifications;
  end if;
end $$;
