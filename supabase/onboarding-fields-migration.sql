-- ============================================================================
-- Rajlo Phase 1C — persist all onboarding form fields
-- Run AFTER auth-migration.sql + storage-migration.sql.
--
-- Why:
--   When a driver resubmits after rejection, we want to pre-fill every text
--   field they previously entered so they only have to fix the rejected docs.
--   These columns weren't in the original drivers schema, so resubmissions
--   show empty inputs for badge number, franchise number, and expiry dates.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.drivers
  add column if not exists badge_number text,
  add column if not exists franchise_number text,
  add column if not exists licence_expiry date,
  add column if not exists franchise_expiry date,
  -- Tracks the most recent time the driver submitted their application for
  -- review. Updated on the initial submission AND on every resubmission, so
  -- the pending screen's "Submitted X mins ago" reflects the latest activity.
  add column if not exists submitted_at timestamptz;

-- Backfill submitted_at for any existing rows so old applications still
-- render a sensible relative time on the pending page.
update public.drivers
  set submitted_at = created_at
  where submitted_at is null;

-- Done. After running:
--   Onboarding API will populate these columns on submit.
--   Resubmission flow will pre-fill them.
--   Pending page will use submitted_at for "X ago".
