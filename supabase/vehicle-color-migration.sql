-- ============================================================================
-- Rajlo Phase 2A — Vehicle colour
-- Run AFTER the original schema + onboarding-fields-migration.sql.
--
-- Adds `vehicle_color` to drivers. Riders need this when meeting their
-- driver in a busy spot — "look for the red Probox" is more useful than
-- just "look for a Probox". The driver-self-edit profile page populates
-- it; old drivers from before this column existed can fill it in
-- themselves from /driver/profile.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.drivers
  add column if not exists vehicle_color text;
