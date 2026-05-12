-- ============================================================================
-- Cache driver's last-known GPS on the rides row
-- ----------------------------------------------------------------------------
-- Private rides previously had no server-side cache of the driver's
-- position — the only signal was the ephemeral `ride:<id>:position`
-- Realtime Broadcast channel. That meant any client opening the map
-- (admin live-trips, the rider after a refresh, an officer landing
-- on the alert detail page) had to wait up to ~5s for the driver's
-- next heartbeat before seeing the car.
--
-- These three columns are updated by the driver's app on a low cadence
-- (~10s) via /api/driver/rides/[id]/position. They give every observer
-- an instant marker on first paint; Realtime overlays fresh pings on
-- top as they arrive.
--
-- Idempotent — safe to re-run.
-- ============================================================================

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS driver_last_lat double precision,
  ADD COLUMN IF NOT EXISTS driver_last_lng double precision,
  ADD COLUMN IF NOT EXISTS driver_last_position_at timestamptz;

COMMENT ON COLUMN public.rides.driver_last_lat IS
  'Driver''s last-known latitude during this ride. Updated ~every 10s by the driver''s app during accepted/arrived/in_progress; null for terminal-state rides.';
