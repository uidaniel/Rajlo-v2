-- ============================================================================
-- Rajlo Phase 2A — Ride request expiry
-- Run AFTER rides-migration.sql.
--
-- Adds a hard timeout to ride requests. When a request hasn't been
-- accepted by `expires_at`, the system auto-cancels it with reason
-- 'expired_no_driver' and the rider sees a "no driver found" state
-- with a retry option.
--
-- Three places enforce the timeout:
--   1. Server-side `expire-on-read` in /api/rider/rides/active —
--      runs on every rider page load + every Realtime push, so the
--      cancellation lands within a few seconds of the deadline
--   2. Driver inbox query filters `expires_at > now()` so expired
--      rides never show up in the driver-facing pool
--   3. Accept endpoint refuses to claim a ride past its expiry
--
-- Without pg_cron we don't run a true scheduled sweep, but the three
-- enforcement points above cover every read path that matters.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. expires_at column ----------
alter table public.rides
  add column if not exists expires_at timestamptz;

-- Partial index over still-pending unexpired requests — drives the
-- driver inbox's hot query (`status='requested' AND driver_id IS
-- NULL AND expires_at > now()`). Cheap because most rows aren't in
-- this state at any given moment.
create index if not exists idx_rides_open_pool_expiry
  on public.rides(expires_at)
  where status = 'requested' and driver_id is null;

-- Backfill any in-flight `requested` rides created before this
-- migration so they don't auto-cancel the moment we deploy. 7 days
-- is way longer than the new 5-minute window — gives drivers a
-- chance to accept anything that was already in the pool.
update public.rides
  set expires_at = requested_at + interval '7 days'
  where expires_at is null
    and status = 'requested';

-- ---------- 2. Helper: atomic expire + return the row ----------
-- Used by the rider's active-ride endpoint to flip stale requests to
-- `cancelled` with reason 'expired_no_driver'. Atomic — if a driver
-- accepts at the exact same instant, the WHERE clause loses the
-- race and the function affects 0 rows (the accept wins cleanly).
create or replace function public.expire_stale_ride(p_ride_id uuid)
returns void
language sql
as $$
  update public.rides
     set status              = 'cancelled',
         cancelled_at        = now(),
         cancellation_reason = 'expired_no_driver'
   where id          = p_ride_id
     and status      = 'requested'
     and driver_id   is null
     and expires_at  is not null
     and expires_at <= now();
$$;
