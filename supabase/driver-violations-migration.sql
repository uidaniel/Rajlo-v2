-- ============================================================================
-- Driver location-policy violations
-- ----------------------------------------------------------------------------
-- Drivers MUST have location enabled while a trip is in flight — the
-- rider's marker, the safety system's off-route + unusual-stop
-- detectors, and the admin's live-trips dashboard all depend on it.
-- A driver who disables location mid-trip breaks all three.
--
-- This table records each violation. Two unresolved violations
-- auto-deactivate the driver (their `deactivated_at` + `deactivation_reason`
-- get set), and admin must explicitly reactivate them via the admin
-- violations page. Reactivation clears the deactivation BUT does NOT
-- require the driver to re-submit their TA docs — it's a behavioural
-- pause, not a verification reset.
--
-- Idempotent — safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.driver_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (
    kind IN (
      'location_off_mid_trip',
      'location_off_while_online',
      'permission_denied_at_toggle'
    )
  ),
  -- Free-text context the client / server appended (e.g., timestamp
  -- the GPS was lost, distance covered while signal was dark).
  details text,
  -- Set when an admin reviews + closes the violation. Closed
  -- violations don't count toward the 2-strike auto-deactivation
  -- threshold.
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_violations_driver
  ON public.driver_violations (driver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_violations_unresolved
  ON public.driver_violations (driver_id)
  WHERE resolved_at IS NULL;

-- Add a deactivation reason column to drivers so the pending page can
-- show "you were deactivated for location violations" + a contact
-- support CTA, distinct from the generic "deactivated by admin" path.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

COMMENT ON TABLE public.driver_violations IS
  'Records of driver behavioural violations (location turned off mid-trip, etc). 2 unresolved violations auto-deactivate the driver. Admin can resolve + reactivate without requiring doc re-submission.';
