-- ============================================================================
-- Rajlo — Driver activity tracking + auto-offline
--
-- Adds `last_active_at` to the drivers table so the platform can flip
-- a driver offline after a configurable period of inactivity. Without
-- this, a driver who closed the app while still "online" stays online
-- forever in the database — riders see them in the available-drivers
-- pool and the driver never receives the request because no app is
-- open to react.
--
-- The flow:
--   - The driver portal's `<DriverActivityTracker>` pings
--     `/api/driver/heartbeat` every few minutes while the driver is
--     interacting with the app (taps, scrolls, key presses).
--   - The heartbeat updates `last_active_at = now()`.
--   - Any read against `is_online = true` SHOULD be paired with a
--     lazy "expire stale" sweep: anything with `last_active_at < now()
--     - interval '1 hour'` gets flipped to `is_online = false`.
--
-- This means a driver who walks away with the app open stays online
-- for as long as their browser tab is active enough to fire pings;
-- a driver who closes the app or loses connectivity goes offline
-- inside an hour without anyone having to act manually.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.drivers
  add column if not exists last_active_at timestamptz;

-- Backfill: existing online drivers get "now" as their last activity
-- so the next heartbeat sweep doesn't flip everyone offline at once.
update public.drivers
  set last_active_at = now()
  where is_online = true and last_active_at is null;

-- Index used by the lazy-expire sweep — only the small set of
-- currently-online drivers needs scanning, so a partial index keeps
-- the sweep query under a few ms even at scale.
create index if not exists idx_drivers_online_last_active
  on public.drivers(last_active_at)
  where is_online = true;
