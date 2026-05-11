-- ============================================================================
-- Auto-cascade auth.users DELETE
-- ----------------------------------------------------------------------------
-- Problem: Supabase's "Delete user" button in Auth → Users fails with
-- "Database error deleting user" because some FK constraint isn't
-- cascading properly. The exact offender varies by schema drift — what
-- matters is we want the Dashboard delete to JUST WORK every time.
--
-- Fix: install a BEFORE DELETE trigger on auth.users that runs first
-- and wipes every public-schema row owned by that user. The auth.users
-- DELETE then proceeds with nothing left to trip on.
--
-- Run this migration once. After that, every Auth Dashboard "Delete"
-- click works without any manual SQL.
--
-- Atomicity: the trigger runs inside the same transaction as the
-- DELETE, so if anything in the cleanup fails OR the auth.users DELETE
-- itself fails afterwards, everything rolls back. No half-deleted
-- users.
--
-- Defensive: every step is guarded by `to_regclass()` so the trigger
-- tolerates schema drift — if a table doesn't exist (migration not
-- run yet), that step skips silently instead of breaking the delete.
--
-- Idempotent: safe to re-run. The CREATE OR REPLACE + DROP TRIGGER
-- IF EXISTS pattern means re-running just updates the logic without
-- duplicating triggers.
-- ============================================================================

-- ─── Step 1: Repair the underlying schema ───
-- `route_hails` has two FKs to `wallet_transactions` that ship without
-- ON DELETE behaviour, so deleting any wallet_transactions row that's
-- referenced by a hail (even a hail belonging to another user) blocks
-- the cascade. Reset them to ON DELETE SET NULL — settlement metadata
-- on a hail is for audit/display only, so losing it when the user is
-- deleted is acceptable.
DO $$
BEGIN
  IF to_regclass('public.route_hails') IS NOT NULL THEN
    -- charged_transaction_id
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'route_hails_charged_transaction_id_fkey'
    ) THEN
      ALTER TABLE public.route_hails
        DROP CONSTRAINT route_hails_charged_transaction_id_fkey;
    END IF;
    ALTER TABLE public.route_hails
      ADD CONSTRAINT route_hails_charged_transaction_id_fkey
      FOREIGN KEY (charged_transaction_id)
      REFERENCES public.wallet_transactions(id)
      ON DELETE SET NULL;

    -- driver_credit_transaction_id
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'route_hails_driver_credit_transaction_id_fkey'
    ) THEN
      ALTER TABLE public.route_hails
        DROP CONSTRAINT route_hails_driver_credit_transaction_id_fkey;
    END IF;
    ALTER TABLE public.route_hails
      ADD CONSTRAINT route_hails_driver_credit_transaction_id_fkey
      FOREIGN KEY (driver_credit_transaction_id)
      REFERENCES public.wallet_transactions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_user_data_before_auth_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  victim_id uuid := OLD.id;
  victim_email text := OLD.email;
BEGIN
  -- ─── Chat / messaging ───
  IF to_regclass('public.route_hail_messages') IS NOT NULL THEN
    DELETE FROM public.route_hail_messages WHERE sender_id = victim_id;
  END IF;
  IF to_regclass('public.ride_messages') IS NOT NULL THEN
    DELETE FROM public.ride_messages WHERE sender_id = victim_id;
  END IF;
  IF to_regclass('public.admin_messages') IS NOT NULL THEN
    DELETE FROM public.admin_messages WHERE actor_id = victim_id;
  END IF;

  -- ─── Notifications + push ───
  IF to_regclass('public.driver_notifications') IS NOT NULL THEN
    DELETE FROM public.driver_notifications WHERE driver_id = victim_id;
  END IF;
  IF to_regclass('public.rider_notifications') IS NOT NULL THEN
    DELETE FROM public.rider_notifications WHERE rider_id = victim_id;
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    DELETE FROM public.push_subscriptions WHERE user_id = victim_id;
  END IF;

  -- ─── Ratings ───
  IF to_regclass('public.ratings') IS NOT NULL THEN
    DELETE FROM public.ratings WHERE rater_id = victim_id OR rated_id = victim_id;
  END IF;

  -- ─── Safety ───
  IF to_regclass('public.safety_alerts') IS NOT NULL THEN
    DELETE FROM public.safety_alerts
    WHERE rider_id = victim_id OR acknowledged_by = victim_id;
  END IF;
  IF to_regclass('public.trip_share_links') IS NOT NULL THEN
    DELETE FROM public.trip_share_links WHERE rider_id = victim_id;
  END IF;
  IF to_regclass('public.trusted_contacts') IS NOT NULL THEN
    DELETE FROM public.trusted_contacts WHERE rider_id = victim_id;
  END IF;

  -- ─── Rider personalisation ───
  IF to_regclass('public.rider_preferences') IS NOT NULL THEN
    DELETE FROM public.rider_preferences WHERE user_id = victim_id;
  END IF;

  -- ─── Money ───
  -- Order matters: transfers and qr_charges reference both parties,
  -- so wipe them before the wallet ledger.
  IF to_regclass('public.wallet_transfers') IS NOT NULL THEN
    DELETE FROM public.wallet_transfers
    WHERE sender_id = victim_id OR recipient_id = victim_id;
  END IF;
  IF to_regclass('public.qr_charges') IS NOT NULL THEN
    DELETE FROM public.qr_charges
    WHERE driver_user_id = victim_id OR rider_user_id = victim_id;
  END IF;
  -- Belt-and-suspenders: even though Step 1 of this migration sets
  -- route_hails' transaction FKs to ON DELETE SET NULL, we also null
  -- the references here defensively. This way the trigger still works
  -- correctly on any clone of the DB where the constraint repair was
  -- somehow rolled back.
  IF to_regclass('public.route_hails') IS NOT NULL
     AND to_regclass('public.wallet_transactions') IS NOT NULL THEN
    UPDATE public.route_hails
    SET charged_transaction_id = NULL
    WHERE charged_transaction_id IN (
      SELECT id FROM public.wallet_transactions
      WHERE user_id = victim_id OR related_user_id = victim_id
    );
    UPDATE public.route_hails
    SET driver_credit_transaction_id = NULL
    WHERE driver_credit_transaction_id IN (
      SELECT id FROM public.wallet_transactions
      WHERE user_id = victim_id OR related_user_id = victim_id
    );
  END IF;
  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    DELETE FROM public.wallet_transactions
    WHERE user_id = victim_id OR related_user_id = victim_id;
  END IF;
  IF to_regclass('public.wallet_withdrawals') IS NOT NULL THEN
    DELETE FROM public.wallet_withdrawals WHERE user_id = victim_id;
  END IF;
  IF to_regclass('public.wallet_deposits') IS NOT NULL THEN
    DELETE FROM public.wallet_deposits WHERE user_id = victim_id;
  END IF;
  IF to_regclass('public.wallets') IS NOT NULL THEN
    DELETE FROM public.wallets WHERE user_id = victim_id;
  END IF;

  -- ─── Trips (rider side) ───
  -- Wipe events + stops BEFORE the rides themselves (they FK to rides).
  IF to_regclass('public.ride_events') IS NOT NULL THEN
    DELETE FROM public.ride_events
    WHERE actor_id IN (victim_id::text, victim_email)
       OR ride_id IN (SELECT id FROM public.rides WHERE rider_id = victim_id);
  END IF;
  IF to_regclass('public.ride_stops') IS NOT NULL THEN
    DELETE FROM public.ride_stops WHERE ride_id IN (
      SELECT id FROM public.rides WHERE rider_id = victim_id
    );
  END IF;
  IF to_regclass('public.rides') IS NOT NULL THEN
    DELETE FROM public.rides WHERE rider_id = victim_id;
  END IF;

  -- ─── Route taxi ───
  IF to_regclass('public.route_hails') IS NOT NULL THEN
    DELETE FROM public.route_hails WHERE rider_id = victim_id;
  END IF;

  -- ─── Driver side ───
  -- Cascade through drivers.id first so driver_documents,
  -- driver_sessions, audit logs all clear before the drivers row.
  IF to_regclass('public.driver_sessions') IS NOT NULL
     AND to_regclass('public.drivers') IS NOT NULL THEN
    DELETE FROM public.driver_sessions WHERE driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = victim_id
    );
  END IF;
  IF to_regclass('public.driver_documents') IS NOT NULL
     AND to_regclass('public.drivers') IS NOT NULL THEN
    DELETE FROM public.driver_documents WHERE driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = victim_id
    );
  END IF;
  IF to_regclass('public.driver_audit_logs') IS NOT NULL
     AND to_regclass('public.drivers') IS NOT NULL THEN
    DELETE FROM public.driver_audit_logs WHERE driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = victim_id
    );
  END IF;
  IF to_regclass('public.vehicle_change_requests') IS NOT NULL
     AND to_regclass('public.drivers') IS NOT NULL THEN
    DELETE FROM public.vehicle_change_requests WHERE driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = victim_id
    );
  END IF;
  IF to_regclass('public.drivers') IS NOT NULL THEN
    DELETE FROM public.drivers WHERE user_id = victim_id;
  END IF;

  -- ─── Admin audit log ───
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    DELETE FROM public.admin_audit_logs WHERE actor_id = victim_id;
  END IF;

  -- ─── Profile last ───
  -- profiles.id FKs to auth.users with ON DELETE CASCADE so this would
  -- happen anyway after the trigger returns — explicit for clarity
  -- and to keep the order predictable.
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = victim_id;
  END IF;

  RETURN OLD;
END $$;

-- Install the trigger. Replace any prior version with the latest body.
DROP TRIGGER IF EXISTS on_auth_user_before_delete ON auth.users;
CREATE TRIGGER on_auth_user_before_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_data_before_auth_delete();

COMMENT ON FUNCTION public.cleanup_user_data_before_auth_delete IS
  'Wipes every public-schema row owned by a user about to be deleted, so the auth.users DELETE has no FK blockers. Wired to the on_auth_user_before_delete trigger — runs automatically.';
