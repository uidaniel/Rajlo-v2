-- ─────────────────────────────────────────────────────────────────────
-- Moderation & enforcement
--
-- Implements the RAJLO Admin Moderation & Enforcement spec. Records
-- every enforcement decision and the active payout holds.
--
--   moderation_actions — append-only log of every enforcement action
--                        taken against a rider/driver (warning,
--                        suspension, ban, reinstatement, payout hold,
--                        …). Never updated or deleted — the trail is
--                        the legal-defensibility record.
--   payout_holds       — an active block on a driver's payouts. A hold
--                        is "lifted" by stamping released_at, not by
--                        deleting the row. The wallet withdrawal path
--                        refuses while any unreleased hold exists.
--
-- Risk flags from the spec are already covered by `fraud_flags`
-- (fraud-risk-migration.sql) — not duplicated here.
--
-- Both tables are service-role-only (RLS enabled, no policies).
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

-- ── moderation_actions ──
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_label text,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_label text,
  action_type text not null,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists moderation_actions_target_idx
  on public.moderation_actions(target_user_id, created_at desc);
create index if not exists moderation_actions_created_idx
  on public.moderation_actions(created_at desc);
alter table public.moderation_actions enable row level security;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'moderation_actions_type_check'
  ) then
    alter table public.moderation_actions
      add constraint moderation_actions_type_check
      check (action_type in (
        'warning',
        'temporary_suspension',
        'permanent_ban',
        'reinstatement',
        'payout_hold',
        'payout_hold_released',
        'trip_restriction',
        'payment_restriction',
        'reverification_required'
      ));
  end if;
end $$;

-- ── payout_holds ──
create table if not exists public.payout_holds (
  id uuid primary key default gen_random_uuid(),
  driver_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  -- Optional specific amount held; null means "all payouts blocked".
  hold_amount numeric,
  created_by uuid references auth.users(id) on delete set null,
  created_by_label text,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users(id) on delete set null
);
-- Fast "does this driver have an active hold" check.
create index if not exists payout_holds_active_idx
  on public.payout_holds(driver_user_id)
  where released_at is null;
alter table public.payout_holds enable row level security;
