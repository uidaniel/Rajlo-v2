-- ============================================================================
-- Rajlo — QR Pay (driver-initiated wallet charge)
--
-- A driver opens the QR Pay screen, types an amount + optional note, and
-- gets a QR code. The QR encodes a Rajlo URL with a short code; when the
-- rider scans it (camera or paste) and confirms, money flows:
--
--   rider wallet  --debit  fare_jmd ──>  Rajlo
--                                    └─> driver wallet  +driver_earnings_jmd
--                                    └─> platform commission_jmd
--
-- The same commission split as Mode B (route taxi). One adapter, one rule.
--
-- Lifecycle:
--   pending → confirmed   (rider scanned + confirmed; wallets settled)
--   pending → cancelled   (driver bailed before scan)
--   pending → expired     (no scan within `expires_at` window)
--
-- The `code` is short (8-char alphanumeric) so the rider can type it
-- as a fallback if the camera scan fails. Unique across all charges,
-- not just live ones — keeps the URL space clean.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.qr_charges (
  id uuid primary key default gen_random_uuid(),

  -- Driver-side identity. We store both the drivers row and the auth
  -- user id because the wallet ledger is keyed on auth.users (every
  -- driver also has a user row).
  driver_id      uuid not null references public.drivers(id) on delete cascade,
  driver_user_id uuid not null references auth.users(id)     on delete cascade,

  -- Set when the rider confirms — null while pending.
  rider_user_id  uuid references auth.users(id) on delete set null,

  amount_jmd integer not null check (amount_jmd > 0),

  -- Optional note shown to the rider on the confirm screen. Drivers
  -- use this for context like "Round 2 fare" or "Tip — thanks!".
  description text,

  -- Short, easily-typeable token. Encoded into the QR payload AND
  -- printable below the QR for fallback typing. Constant length
  -- 8 chars so the input UX is predictable.
  code text not null unique check (length(code) = 8),

  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'expired', 'cancelled')),

  expires_at timestamptz not null,
  confirmed_at timestamptz,
  cancelled_at timestamptz,

  -- Settlement bookkeeping (mirrors route_hails so reconciliation
  -- queries are uniform across hail charges + QR charges).
  commission_jmd      integer check (commission_jmd      is null or commission_jmd      >= 0),
  driver_earnings_jmd integer check (driver_earnings_jmd is null or driver_earnings_jmd >= 0),
  rider_charge_transaction_id  uuid references public.wallet_transactions(id),
  driver_credit_transaction_id uuid references public.wallet_transactions(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Driver dashboard: "show me my last 50 charges, newest first."
create index if not exists idx_qr_charges_driver
  on public.qr_charges(driver_id, created_at desc);

-- Rider history: "what QRs have I paid?"
create index if not exists idx_qr_charges_rider
  on public.qr_charges(rider_user_id, created_at desc)
  where rider_user_id is not null;

-- Janitor query: pick up pending charges past their expiry to mark
-- as 'expired'. A periodic job (or admin page button) can sweep these.
create index if not exists idx_qr_charges_pending_expiring
  on public.qr_charges(expires_at)
  where status = 'pending';

drop trigger if exists trg_qr_charges_updated_at on public.qr_charges;
create trigger trg_qr_charges_updated_at
  before update on public.qr_charges
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.qr_charges enable row level security;

-- Driver reads their own charges (live + history).
drop policy if exists "Drivers read own QR charges" on public.qr_charges;
create policy "Drivers read own QR charges"
  on public.qr_charges for select
  using (driver_user_id = auth.uid());

-- Rider reads charges they've paid (history) AND charges they're
-- previewing (matched on code by the API, not by row id, so the SELECT
-- here only matters for "my paid history" — preview happens via the
-- service-role API).
drop policy if exists "Riders read own QR payments" on public.qr_charges;
create policy "Riders read own QR payments"
  on public.qr_charges for select
  using (rider_user_id = auth.uid());

-- Admins read all (for support + reconciliation dashboards).
drop policy if exists "Admins read all QR charges" on public.qr_charges;
create policy "Admins read all QR charges"
  on public.qr_charges for select
  using (
    exists (select 1 from public.profiles
             where profiles.id = auth.uid() and profiles.role = 'admin')
  );
