-- ============================================================================
-- Off-route detection
-- ----------------------------------------------------------------------------
-- Phase 5 of the safety system. Two pieces:
--
--   1. `rides` gains a planned route polyline (Google Directions
--      encoded polyline format, plus distance + duration baselines).
--      Captured at trip start so we have a stable reference to compare
--      the driver's live position against.
--
--   2. `safety_alerts.kind` CHECK is widened to allow `off_route` so
--      the rider's client can raise an alert when the driver has been
--      ≥300m off the planned polyline for ≥2 minutes during in_progress.
--
-- Why store the polyline?
--   The route between two points is non-trivial to recompute on every
--   GPS ping, and Directions API calls cost real money. One call per
--   trip (at start) gives us a frozen reference we can match against
--   purely on the client.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ─── 1. Extend rides with planned route fields ───
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS planned_polyline text,
  ADD COLUMN IF NOT EXISTS planned_distance_m integer,
  ADD COLUMN IF NOT EXISTS planned_duration_s integer,
  ADD COLUMN IF NOT EXISTS planned_route_fetched_at timestamptz;

COMMENT ON COLUMN public.rides.planned_polyline IS
  'Google Directions encoded polyline (algorithm 1, precision 5) from pickup to dropoff. Captured at trip start; used by the off-route detector to compare against live driver position.';

-- ─── 2. Widen safety_alerts.kind CHECK to include off_route ───
-- The constraint was previously rewritten by safety-checks-migration.sql
-- to allow 'sos','flag','unusual_stop'. Find whatever's there now and
-- replace it with the superset that adds 'off_route'.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.safety_alerts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%kind%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.safety_alerts DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.safety_alerts
    ADD CONSTRAINT safety_alerts_kind_check
    CHECK (kind IN ('sos', 'flag', 'unusual_stop', 'off_route'));
END $$;
