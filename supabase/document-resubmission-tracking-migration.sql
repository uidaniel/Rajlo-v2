-- ============================================================================
-- Rajlo Phase 1F — Track previously-approved documents
-- Run AFTER auth-migration.sql + storage-migration.sql.
--
-- Why:
--   When a driver re-uploads a doc that was already approved (via the wizard's
--   edit-mode), the admin needs to know — otherwise a freshly-replaced file
--   slips through with the original "Approved" badge. Now the doc flips to
--   "pending" and `previously_approved = true` so the verification detail
--   page can flag it: "previously approved · re-uploaded by driver".
--
--   The flag is informational. Once the admin re-approves, the status is
--   "approved" again and the flag is cleared by the decision API.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.driver_documents
  add column if not exists previously_approved boolean not null default false;

-- Done. After running:
--   - Onboarding API sets previously_approved=true when a driver replaces an
--     already-approved doc.
--   - Deactivate API sets it for every approved doc when an active driver is
--     pulled back into review.
--   - Decision API clears it when the admin re-approves.
--   - verification-detail page renders an alert + per-doc badge.
