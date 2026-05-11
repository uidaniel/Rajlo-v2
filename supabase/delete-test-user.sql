-- ============================================================================
-- Manual test-user cleanup
-- ----------------------------------------------------------------------------
-- Use this when Supabase's "Delete user" button in the Auth dashboard fails
-- with "Database error deleting user". That usually means a FK constraint
-- somewhere isn't cascading the way it should be — this script wipes every
-- row the user owns across the app, so the final auth.users delete has
-- nothing left to trip on.
--
-- HOW TO RUN:
--   1. supabase.com → Project → SQL Editor → New query
--   2. Paste this whole file
--   3. Replace the EMAIL on the line below with the address of the user
--      you want to delete
--   4. Run
--   5. Go back to Auth → Users and confirm the user is gone (or click
--      Delete again if still listed — it should now succeed)
--
-- Defensive: every DELETE is guarded by `to_regclass()` so the script
-- tolerates schema drift — if a table doesn't exist on your project
-- (because a migration hasn't run), that step is silently skipped
-- instead of aborting the whole cleanup.
-- ============================================================================

DO $$
DECLARE
  victim_email text := 'uakdan209@gmail.com';   -- <-- CHANGE THIS
  victim_id uuid;
BEGIN
  -- Look the user up by email.
  SELECT id INTO victim_id FROM auth.users WHERE email = victim_email;
  IF victim_id IS NULL THEN
    RAISE NOTICE 'No user found with email %', victim_email;
    RETURN;
  END IF;
  RAISE NOTICE 'Cleaning up user %', victim_id;

  -- ─── App data — every DELETE guarded by table existence ───

  -- Chat / messaging
  IF to_regclass('public.route_hail_messages') IS NOT NULL THEN
    DELETE FROM public.route_hail_messages WHERE sender_id = victim_id;
  END IF;
  IF to_regclass('public.ride_messages') IS NOT NULL THEN
    DELETE FROM public.ride_messages WHERE sender_id = victim_id;
  END IF;
  IF to_regclass('public.admin_messages') IS NOT NULL THEN
    DELETE FROM public.admin_messages WHERE actor_id = victim_id;
  END IF;

  -- Notifications + push
  IF to_regclass('public.driver_notifications') IS NOT NULL THEN
    DELETE FROM public.driver_notifications WHERE driver_id = victim_id;
  END IF;
  IF to_regclass('public.rider_notifications') IS NOT NULL THEN
    DELETE FROM public.rider_notifications WHERE rider_id = victim_id;
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    DELETE FROM public.push_subscriptions WHERE user_id = victim_id;
  END IF;

  -- Ratings
  IF to_regclass('public.ratings') IS NOT NULL THEN
    DELETE FROM public.ratings WHERE rater_id = victim_id OR rated_id = victim_id;
  END IF;

  -- Safety
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

  -- Rider personalisation
  IF to_regclass('public.rider_preferences') IS NOT NULL THEN
    DELETE FROM public.rider_preferences WHERE user_id = victim_id;
  END IF;

  -- Money
  IF to_regclass('public.wallet_transfers') IS NOT NULL THEN
    DELETE FROM public.wallet_transfers
    WHERE sender_id = victim_id OR recipient_id = victim_id;
  END IF;
  IF to_regclass('public.qr_charges') IS NOT NULL THEN
    DELETE FROM public.qr_charges
    WHERE driver_user_id = victim_id OR rider_user_id = victim_id;
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

  -- Trips (rider side)
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

  -- Route taxi
  IF to_regclass('public.route_hails') IS NOT NULL THEN
    DELETE FROM public.route_hails WHERE rider_id = victim_id;
  END IF;

  -- Driver side — first cascade dependents through drivers.id
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

  -- Admin audit log
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    DELETE FROM public.admin_audit_logs WHERE actor_id = victim_id;
  END IF;

  -- Profile last (profiles itself FKs to auth.users with cascade so this
  -- would happen anyway — explicit for clarity).
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = victim_id;
  END IF;

  RAISE NOTICE 'Done. Now go to Auth → Users and click Delete on % — should succeed.', victim_email;
END $$;
