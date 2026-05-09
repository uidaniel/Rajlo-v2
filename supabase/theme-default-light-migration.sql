-- ============================================================================
-- Rajlo — Switch default theme to light
--
-- The platform default flips from "system" to "light" so brand-new
-- accounts paint in light mode out of the box. Existing rows are left
-- alone — riders who already saved a preference keep it. Only the
-- column default for FUTURE inserts changes.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.rider_preferences
  alter column theme set default 'light';
