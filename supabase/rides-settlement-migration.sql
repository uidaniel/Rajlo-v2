-- Settlement columns for the private-ride completion flow.
--
-- Mirrors what `route_hails` already records (commission_jmd,
-- driver_earnings_jmd, charged_transaction_id, driver_credit_transaction_id)
-- so the admin reconciliation surface can treat both ride types the same way.
--
-- `settlement_status` lets admin queues filter on "rides that completed but
-- whose money never moved" — those are the ones that need manual
-- intervention via /admin/wallets/[userId]/adjust.
--
-- Run order: after the original rides-migration.sql.

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS commission_jmd int,
  ADD COLUMN IF NOT EXISTS driver_earnings_jmd int,
  ADD COLUMN IF NOT EXISTS settlement_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS settlement_error text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rider_charge_transaction_id uuid REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_credit_transaction_id uuid REFERENCES wallet_transactions(id) ON DELETE SET NULL;

-- Constrain settlement_status to a known set so a typo in the API can't
-- write a value that breaks admin filters.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rides_settlement_status_check'
  ) THEN
    ALTER TABLE rides
      ADD CONSTRAINT rides_settlement_status_check
      CHECK (settlement_status IN (
        'pending',
        'settled',
        'rider_debit_failed',
        'driver_credit_failed',
        'skipped_zero_fare'
      ));
  END IF;
END$$;

-- Partial index so admin queues for unsettled rides scan a tiny subset.
CREATE INDEX IF NOT EXISTS rides_unsettled_idx
  ON rides (status, settlement_status)
  WHERE settlement_status <> 'settled';
