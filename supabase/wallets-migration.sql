-- ============================================================================
-- Rajlo — Wallets, transactions, deposits, withdrawals, transfers
--
-- A single per-user wallet that holds JMD. Riders deposit + spend on
-- rides; drivers earn + withdraw to their bank. Same surface for both
-- so a rider who later activates as a driver doesn't need a separate
-- balance.
--
-- Design principles:
--
--   1. **Append-only ledger.** `wallet_transactions` is the source of
--      truth. The wallet's `balance_jmd` column is just a fast-read
--      cache, kept in sync by a trigger. If the trigger ever lags or
--      a row is corrupted, we can rebuild the balance by summing
--      transactions for that user.
--
--   2. **Atomic balance updates.** The trigger uses a row-level lock
--      (SELECT ... FOR UPDATE) so two concurrent transactions for
--      the same wallet can't race to the same `balance_after_jmd`
--      snapshot.
--
--   3. **Non-negative invariant.** Both the wallet table and the
--      ledger snapshot enforce `balance >= 0`. A debit that would
--      drop the balance below zero is rejected by the CHECK
--      constraint, surfacing as an error from the helper code rather
--      than silently corrupting state.
--
--   4. **Service-role only writes.** RLS lets users SELECT their own
--      wallet + transactions, but ALL writes go through the
--      service-role key from server-side code that wraps balance
--      logic. Direct UPDATEs on the wallet table from the client are
--      blocked, period.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ─────────────── wallets ───────────────
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_jmd integer not null default 0
    check (balance_jmd >= 0),
  currency text not null default 'JMD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wallets_balance on public.wallets(balance_jmd desc);

drop trigger if exists trg_wallets_updated_at on public.wallets;
create trigger trg_wallets_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

-- ─────────────── wallet_transactions (append-only ledger) ───────────────
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- 'credit' adds to the balance, 'debit' subtracts.
  direction text not null check (direction in ('credit', 'debit')),
  amount_jmd integer not null check (amount_jmd > 0),

  -- What sort of transaction. Used for filtering + UI badging.
  kind text not null check (kind in (
    'deposit',         -- rider added money via payment gateway
    'ride_charge',     -- rider charged for a completed ride
    'ride_earning',    -- driver received payout for a completed ride
    'withdrawal',      -- driver withdrew to a bank account
    'withdrawal_refund', -- failed/cancelled withdrawal returned
    'transfer_out',    -- sent money to another user
    'transfer_in',     -- received money from another user
    'admin_credit',    -- admin manually adjusted balance up
    'admin_debit',     -- admin manually adjusted balance down
    'refund'           -- ride refund, dispute resolution, etc.
  )),

  -- Optional foreign keys to the entities that caused this entry.
  ride_id uuid references public.rides(id) on delete set null,
  related_user_id uuid references auth.users(id) on delete set null,
  deposit_id uuid,
  withdrawal_id uuid,
  transfer_id uuid,

  description text,
  metadata jsonb,

  -- Snapshot of the balance AFTER this transaction. Lets the wallet
  -- page render a running balance column without recomputing.
  balance_after_jmd integer not null check (balance_after_jmd >= 0),

  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_txns_user
  on public.wallet_transactions(user_id, created_at desc);
create index if not exists idx_wallet_txns_kind
  on public.wallet_transactions(kind, created_at desc);
create index if not exists idx_wallet_txns_ride
  on public.wallet_transactions(ride_id)
  where ride_id is not null;

-- ─────────────── Trigger: keep wallets.balance_jmd in sync ───────────────
create or replace function public.apply_wallet_transaction()
returns trigger language plpgsql as $$
declare
  current_balance integer;
  new_balance integer;
begin
  -- Lock the wallet row for the duration of this transaction so
  -- concurrent inserts see consistent state.
  select balance_jmd into current_balance
    from public.wallets
    where user_id = new.user_id
    for update;

  -- Lazy-create the wallet on first transaction. New users don't
  -- need an explicit "create wallet" call.
  if current_balance is null then
    insert into public.wallets (user_id, balance_jmd)
      values (new.user_id, 0)
      on conflict (user_id) do nothing;
    current_balance := 0;
  end if;

  if new.direction = 'credit' then
    new_balance := current_balance + new.amount_jmd;
  else
    new_balance := current_balance - new.amount_jmd;
  end if;

  if new_balance < 0 then
    raise exception 'Insufficient balance — debit of % JMD would leave wallet at % JMD', new.amount_jmd, new_balance;
  end if;

  -- Set the snapshot on the inserted row, then update the cache.
  new.balance_after_jmd := new_balance;
  update public.wallets
    set balance_jmd = new_balance, updated_at = now()
    where user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_wallet_txn_apply on public.wallet_transactions;
create trigger trg_wallet_txn_apply
  before insert on public.wallet_transactions
  for each row execute function public.apply_wallet_transaction();

-- ─────────────── wallet_deposits ───────────────
-- A "rider topped up" record. Created when the rider clicks Deposit;
-- flipped to 'completed' by the gateway's IPN webhook; THAT is what
-- triggers the actual credit transaction.
create table if not exists public.wallet_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  amount_jmd integer not null check (amount_jmd > 0),

  gateway text not null,                  -- 'wipay', 'manual', 'bank_transfer'
  gateway_reference text,                 -- gateway's order id / txn id
  gateway_redirect_url text,              -- where to send the user to pay

  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'cancelled')),

  -- Free-form gateway response payload — useful for audit/debug.
  metadata jsonb,

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_wallet_deposits_user
  on public.wallet_deposits(user_id, created_at desc);
create index if not exists idx_wallet_deposits_status
  on public.wallet_deposits(status, created_at desc);

-- ─────────────── wallet_withdrawals ───────────────
-- A "driver wants to cash out" request. Admin reviews, marks as paid
-- once the bank transfer is sent.
create table if not exists public.wallet_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  amount_jmd integer not null check (amount_jmd > 0),

  bank_name text,
  bank_account_number text,
  account_holder_name text,

  status text not null default 'pending'
    check (status in (
      'pending',     -- admin hasn't reviewed yet
      'processing',  -- admin started the bank transfer
      'paid',        -- bank transfer confirmed sent
      'rejected',    -- admin rejected
      'cancelled'    -- driver cancelled before admin acted
    )),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_withdrawals_user
  on public.wallet_withdrawals(user_id, created_at desc);
create index if not exists idx_wallet_withdrawals_status
  on public.wallet_withdrawals(status, created_at desc);

-- ─────────────── wallet_transfers ───────────────
-- Rider sending money to another rider. Two-step: initiate (debits
-- the sender, sends OTP) → verify (credits the recipient).
--
-- We debit the sender at initiate time so they can't double-spend
-- while the OTP is in flight. If they cancel or the OTP expires,
-- we refund. The recipient only sees the money once the OTP is
-- verified.
create table if not exists public.wallet_transfers (
  id uuid primary key default gen_random_uuid(),

  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  amount_jmd integer not null check (amount_jmd > 0),
  message text,

  -- OTP fields. Code is stored as a SHA-256 hash so a leak of the
  -- table doesn't expose the actual digits. The verify endpoint
  -- hashes the submitted code and compares.
  otp_hash text not null,
  otp_method text not null check (otp_method in ('email', 'sms')),
  otp_sent_to text not null,
  otp_attempts integer not null default 0,

  status text not null default 'pending_verification'
    check (status in (
      'pending_verification',
      'completed',
      'cancelled',
      'expired'
    )),

  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),

  -- Sender can't transfer to themselves.
  check (sender_id <> recipient_id)
);

create index if not exists idx_wallet_transfers_sender
  on public.wallet_transfers(sender_id, created_at desc);
create index if not exists idx_wallet_transfers_recipient
  on public.wallet_transfers(recipient_id, created_at desc);
create index if not exists idx_wallet_transfers_pending
  on public.wallet_transfers(expires_at)
  where status = 'pending_verification';

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.wallets               enable row level security;
alter table public.wallet_transactions   enable row level security;
alter table public.wallet_deposits       enable row level security;
alter table public.wallet_withdrawals    enable row level security;
alter table public.wallet_transfers      enable row level security;

-- Wallets: user reads own row. NEVER write from the client; all
-- mutations flow through service_role so the trigger logic stays the
-- single source of truth.
drop policy if exists "Users read own wallet" on public.wallets;
create policy "Users read own wallet"
  on public.wallets for select
  using (user_id = auth.uid());

-- Transactions: user reads their own.
drop policy if exists "Users read own wallet txns" on public.wallet_transactions;
create policy "Users read own wallet txns"
  on public.wallet_transactions for select
  using (user_id = auth.uid());

-- Deposits: user reads own.
drop policy if exists "Users read own deposits" on public.wallet_deposits;
create policy "Users read own deposits"
  on public.wallet_deposits for select
  using (user_id = auth.uid());

-- Withdrawals: user reads own.
drop policy if exists "Users read own withdrawals" on public.wallet_withdrawals;
create policy "Users read own withdrawals"
  on public.wallet_withdrawals for select
  using (user_id = auth.uid());

-- Transfers: sender or recipient reads.
drop policy if exists "Users read own transfers" on public.wallet_transfers;
create policy "Users read own transfers"
  on public.wallet_transfers for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Admins read everything across all wallet tables.
drop policy if exists "Admins read all wallets" on public.wallets;
create policy "Admins read all wallets"
  on public.wallets for select
  using (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Admins read all wallet txns" on public.wallet_transactions;
create policy "Admins read all wallet txns"
  on public.wallet_transactions for select
  using (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Admins read all deposits" on public.wallet_deposits;
create policy "Admins read all deposits"
  on public.wallet_deposits for select
  using (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Admins read all withdrawals" on public.wallet_withdrawals;
create policy "Admins read all withdrawals"
  on public.wallet_withdrawals for select
  using (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Admins read all transfers" on public.wallet_transfers;
create policy "Admins read all transfers"
  on public.wallet_transfers for select
  using (
    exists (select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin')
  );
