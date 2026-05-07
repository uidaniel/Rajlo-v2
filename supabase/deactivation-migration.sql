-- ============================================================================
-- Rajlo Phase 1E — Track deactivated drivers
-- Run AFTER auth-migration.sql.
--
-- Why:
--   When admin pulls an active driver back into review, the driver lands on
--   /driver/pending — same screen a first-time submitter sees. That's
--   misleading: a deactivated driver hasn't just submitted, they've been
--   pulled out of an active state. We need to show them a different message
--   ("Account deactivated · contact support") so they understand what
--   happened.
--
--   The cleanest way to detect this is a dedicated timestamp column. Set on
--   deactivation, cleared on re-activation. If it's set AND the driver is
--   not currently activated, we're in the "deactivated, awaiting re-review"
--   state.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.drivers
  add column if not exists deactivated_at timestamptz;

-- Done. After running:
--   - Deactivate API stamps deactivated_at = now() on deactivation.
--   - Decision API clears deactivated_at = null on re-activation.
--   - getDriverStatus() returns state="deactivated" while it's set.
--   - /driver/pending renders the deactivation hero in that state.
