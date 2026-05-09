-- ============================================================================
-- Rajlo — Route Taxi Phase 2: settlement + commission columns
--
-- Adds the bookkeeping columns needed when a hail completes:
--   commission_jmd       — Rajlo's cut of the fare (platform commission)
--   driver_earnings_jmd  — what the driver actually banks (fare - commission)
--   driver_credit_transaction_id — wallet ledger row that credited the driver
--
-- These are denormalised from `fare_jmd × commission_pct` for two reasons:
--   1. The commission rate may change over time; a stored split preserves
--      what we actually paid the driver on this trip.
--   2. Reconciliation queries (driver earnings reports, platform revenue
--      dashboards) become single-table sums — no recomputation.
--
-- The `charged_transaction_id` column already exists from Phase 1; we add
-- its driver-side mirror here.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.route_hails
  add column if not exists commission_jmd integer
    check (commission_jmd is null or commission_jmd >= 0);

alter table public.route_hails
  add column if not exists driver_earnings_jmd integer
    check (driver_earnings_jmd is null or driver_earnings_jmd >= 0);

alter table public.route_hails
  add column if not exists driver_credit_transaction_id uuid
    references public.wallet_transactions(id);

-- For reconciliation: "show me all settled hails in date range".
create index if not exists idx_route_hails_completed
  on public.route_hails(completed_at desc)
  where status = 'completed';

-- For driver earnings dashboards.
create index if not exists idx_route_hails_driver_settled
  on public.route_hails(session_id, completed_at desc)
  where status = 'completed';
