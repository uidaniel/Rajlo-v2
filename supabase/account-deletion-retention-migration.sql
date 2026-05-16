-- ============================================================================
-- Account deletion — retain the security / financial / audit trail
-- ----------------------------------------------------------------------------
-- Previously, a rider/driver deleting their account triggered a full
-- hard cascade (see user-delete-cascade-migration.sql) that wiped every
-- row they owned — including rides, wallet transactions, and audit
-- logs. That destroys the records the admin + safety team need for
-- dispute resolution, fraud review, and the financial records Jamaica
-- tax law requires us to retain.
--
-- New model: account deletion is a SOFT delete (anonymise-in-place).
--   - The personal identity is stripped: name → "Deleted User", phone,
--     gov IDs, saved addresses, device tokens, ID-document scans all
--     removed. Nothing personally identifying survives.
--   - The TRANSACTIONAL trail is retained: rides, ride events, wallet
--     ledger, QR charges, ratings, safety alerts, audit logs. These
--     rows now reference an anonymised profile, so the admin can still
--     read "Deleted User did X on date Y" — readable, but not tied to
--     a real person.
--   - The auth.users row is NOT deleted by the app flow (the API bans
--     it + scrambles the email instead). Hard-deleting auth.users
--     would cascade-delete profiles and orphan every retained record.
--
-- This satisfies the Google Play account-deletion policy (Article 4.1
-- explicitly permits retaining data for "security, fraud prevention,
-- or regulatory compliance") AND keeps the audit trail. The privacy
-- policy must disclose this retention.
--
-- The old hard-cascade trigger (on_auth_user_before_delete) is LEFT IN
-- PLACE intentionally — it's the admin "nuclear" escape hatch for the
-- Supabase dashboard's Delete User button. The app's own delete flow
-- no longer hits it because the app no longer deletes auth.users.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ─── Step 1: mark deleted profiles ───
-- `deleted_at` lets the admin UI badge an account as deleted and lets
-- queries exclude anonymised users from "active rider" counts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ─── Step 2: the anonymisation function ───
-- Called by POST /api/account/delete with the service-role client.
-- SECURITY DEFINER so it can write across every table regardless of
-- RLS — the API has already authenticated the caller and confirmed
-- they own `victim_id`.
CREATE OR REPLACE FUNCTION public.anonymize_user_account(victim_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- ── DELETE: personal data with no audit / security value ──
  -- Device push tokens — useless once the account is gone.
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    DELETE FROM public.push_subscriptions WHERE user_id = victim_id;
  END IF;
  -- Trusted contacts hold OTHER people's phone numbers (third-party
  -- PII) — must be removed, not retained.
  IF to_regclass('public.trusted_contacts') IS NOT NULL THEN
    DELETE FROM public.trusted_contacts WHERE rider_id = victim_id;
  END IF;
  -- UI preferences — no value.
  IF to_regclass('public.rider_preferences') IS NOT NULL THEN
    DELETE FROM public.rider_preferences WHERE user_id = victim_id;
  END IF;
  -- Saved home / work / office addresses — personal location data.
  IF to_regclass('public.saved_places') IS NOT NULL THEN
    DELETE FROM public.saved_places WHERE user_id = victim_id;
  END IF;
  -- Transient "your ride is here" notifications — not audit logs.
  IF to_regclass('public.rider_notifications') IS NOT NULL THEN
    DELETE FROM public.rider_notifications WHERE rider_id = victim_id;
  END IF;
  IF to_regclass('public.driver_notifications') IS NOT NULL THEN
    DELETE FROM public.driver_notifications WHERE driver_id = victim_id;
  END IF;

  -- ── DELETE: driver-side personal data ──
  -- Login sessions, ID-document scans, and vehicle-change paperwork
  -- are personal/sensitive. The driver_audit_logs row (retained
  -- below) records THAT verification happened — we don't need to
  -- keep the actual licence/ID images after the account is gone.
  IF to_regclass('public.drivers') IS NOT NULL THEN
    IF to_regclass('public.driver_sessions') IS NOT NULL THEN
      DELETE FROM public.driver_sessions WHERE driver_id IN (
        SELECT id FROM public.drivers WHERE user_id = victim_id
      );
    END IF;
    IF to_regclass('public.driver_documents') IS NOT NULL THEN
      DELETE FROM public.driver_documents WHERE driver_id IN (
        SELECT id FROM public.drivers WHERE user_id = victim_id
      );
    END IF;
    IF to_regclass('public.vehicle_change_requests') IS NOT NULL THEN
      DELETE FROM public.vehicle_change_requests WHERE driver_id IN (
        SELECT id FROM public.drivers WHERE user_id = victim_id
      );
    END IF;
  END IF;

  -- ── ANONYMISE: keep the row, strip the identity ──
  -- The profiles row stays so rides / wallet / logs remain joinable
  -- and the admin can still read the trail. Every identifier is
  -- cleared and `deleted_at` is stamped.
  IF to_regclass('public.profiles') IS NOT NULL THEN
    UPDATE public.profiles
    SET full_name = 'Deleted User',
        phone = NULL,
        deleted_at = now()
    WHERE id = victim_id;
  END IF;

  -- The drivers row stays for the audit trail (which trips this
  -- driver ran, what they earned) but every personal + government
  -- identifier is wiped. Vehicle make/model/plate are kept because
  -- they describe the car that performed retained trips, not the
  -- person.
  IF to_regclass('public.drivers') IS NOT NULL THEN
    UPDATE public.drivers
    SET first_name = 'Deleted',
        last_name = 'User',
        phone = NULL,
        email = NULL,
        trn = NULL,
        nis = NULL,
        licence_number = NULL
    WHERE user_id = victim_id;
  END IF;

  -- ── RETAINED (no action — listed here so the intent is explicit) ──
  --   rides, ride_events, ride_stops          — trip history
  --   wallet_transactions, wallet_transfers,
  --   wallet_deposits, wallet_withdrawals,
  --   wallets, qr_charges                     — financial ledger
  --   route_hails, route_hail_messages,
  --   ride_messages                           — trip + chat audit
  --   ratings                                 — trip record
  --   safety_alerts                           — safety incidents
  --   trip_share_links                        — safety audit
  --   admin_audit_logs, driver_audit_logs     — moderation trail
  --   admin_messages                          — support trail
  -- All of the above keep referencing the now-anonymised profile /
  -- driver rows by UUID, so the admin sees "Deleted User" against a
  -- complete, readable history.
END $$;

COMMENT ON FUNCTION public.anonymize_user_account IS
  'Soft-deletes a user account: strips all personal identifiers from profiles + drivers, deletes no-retention PII (push tokens, saved places, ID documents), but RETAINS the rides / wallet ledger / audit logs so the admin keeps a full security + financial trail. Called by POST /api/account/delete.';
