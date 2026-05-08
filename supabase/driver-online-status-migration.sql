-- ============================================================================
-- Rajlo — Driver online/offline status persistence
--
-- Adds two columns to drivers:
--   is_online           — boolean, true while the driver is actively
--                          accepting ride requests. Default false so a
--                          newly-activated driver doesn't auto-broadcast
--                          location until they tap "Go online".
--   went_online_at      — timestamp of the most recent online toggle.
--                          Useful for "online for 2h 15m" UI + analytics.
--
-- The existing /driver home page kept this state in React only, so it
-- reset to "online" on every refresh — leaking GPS broadcasts the
-- driver may not have wanted active. This migration moves it to the
-- database so refresh / multi-tab / sign-back-in all reflect the
-- driver's most recent intent.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.drivers
  add column if not exists is_online boolean not null default false;

alter table public.drivers
  add column if not exists went_online_at timestamptz;

-- Index used by `/api/driver/inbox` and any future "drivers nearby"
-- query that wants to filter to currently-online drivers only. Partial
-- so it stays small — most drivers are offline at any given moment.
create index if not exists idx_drivers_is_online
  on public.drivers(is_online)
  where is_online = true;
