-- ============================================================================
-- Driver-level position cache for online-driver radius matching
-- ----------------------------------------------------------------------------
-- The fleet broadcaster (useFleetBroadcaster) already pushes online
-- driver positions over Realtime to the rider's booking screen so
-- riders see nearby drivers on the map. But the server doesn't have
-- those positions (broadcasts are ephemeral), which means the
-- new-ride fan-out at /api/rider/rides currently pings EVERY online
-- driver regardless of distance.
--
-- These three columns let the driver's app post their position once
-- every ~30 seconds while online. The new-ride matcher then filters
-- to drivers within a configurable radius (default 8 km) of the
-- rider's pickup. Drivers 30 km away stop getting pinged for trips
-- they can't realistically pick up.
--
-- Idempotent — safe to re-run.
-- ============================================================================

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS last_lat double precision,
  ADD COLUMN IF NOT EXISTS last_lng double precision,
  ADD COLUMN IF NOT EXISTS last_position_at timestamptz;

-- Index helps the new-ride matcher narrow to "drivers who pinged in
-- the last 5 minutes" without a full table scan. Without it, every
-- new-ride POST would scan all drivers.
CREATE INDEX IF NOT EXISTS idx_drivers_last_position_at
  ON public.drivers (last_position_at DESC)
  WHERE last_position_at IS NOT NULL;

COMMENT ON COLUMN public.drivers.last_lat IS
  'Driver''s last-known latitude while online. Updated ~every 30s by the driver app. Used by /api/rider/rides to filter the new-ride push fan-out to drivers within radius of pickup.';
