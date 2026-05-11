-- ============================================================================
-- Safety checks — extend safety_alerts to support auto-triggered
-- "are you OK?" prompts on unusual stops.
-- ----------------------------------------------------------------------------
-- The existing `safety_alerts` table covered manual rider SOS + soft
-- "flag" reports. We now add a third kind, `unusual_stop`, that the
-- platform auto-creates when the driver hasn't moved for ~4 minutes
-- during an in-progress trip. The rider's app pops a modal and logs
-- the response on the same row (resolved with note "rider confirmed
-- safe", or escalated to a real SOS).
--
-- Why extend the existing table instead of a separate `safety_checks`
-- table: every auto-check IS a potential alert. Treating them as the
-- same row simplifies the admin queue (one place to look) and matches
-- the way ops actually triages — they don't care whether the alert
-- was rider-triggered or system-triggered, only whether it's still
-- open and what the rider needs.
--
-- Idempotent — safe to re-run.
-- ============================================================================

DO $$
BEGIN
  -- Replace the CHECK constraint on `kind` to accept the new value.
  -- We drop the old constraint by name (which Supabase auto-names when
  -- the column is defined inline) and add a fresh one that includes
  -- `unusual_stop`.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'safety_alerts_kind_check'
  ) THEN
    ALTER TABLE public.safety_alerts
      DROP CONSTRAINT safety_alerts_kind_check;
  END IF;

  ALTER TABLE public.safety_alerts
    ADD CONSTRAINT safety_alerts_kind_check
    CHECK (kind IN ('sos', 'flag', 'unusual_stop'));
END $$;

-- Helpful index — admin queues frequently filter by kind alongside
-- status (e.g. "unresolved unusual_stop alerts in the last 24 hours").
CREATE INDEX IF NOT EXISTS idx_safety_alerts_kind_status
  ON public.safety_alerts (kind, status, created_at DESC);
