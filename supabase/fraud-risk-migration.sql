-- ─────────────────────────────────────────────────────────────────────
-- Fraud detection & risk scoring
--
-- Implements the RAJLO Fraud Detection & Risk Scoring spec. Four
-- tables, all strictly internal — RLS is enabled with no policies, so
-- they're reachable only via the service-role key (the admin + capture
-- APIs). Fraud data is never exposed to the riders/drivers it concerns.
--
--   device_fingerprints  — one row per (user, device session) seen.
--                          Shared fingerprint_hash / ip_address across
--                          users is the multi-account / fraud-ring
--                          signal.
--   fraud_risk_scores    — the CURRENT 0–100 risk score per user
--                          (one row per user, recalculated in place).
--   fraud_flags          — discrete fraud signals raised against a
--                          user (gps_spoofing, multi_account_detection,
--                          chargeback_abuse, …). Append-only; a flag is
--                          "cleared" by stamping resolved_at, not
--                          deleting it.
--   fraud_investigations — a formal investigation opened on a user,
--                          assigned to an admin, with a resolution.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

-- ── device_fingerprints ──
create table if not exists public.device_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Stable client-generated id persisted in the device's storage.
  device_id text,
  device_type text,
  app_version text,
  os_version text,
  ip_address text,
  -- Hash of the stable browser/device signal set — the value compared
  -- across accounts to detect device reuse.
  fingerprint_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists device_fingerprints_user_idx
  on public.device_fingerprints(user_id, created_at desc);
create index if not exists device_fingerprints_hash_idx
  on public.device_fingerprints(fingerprint_hash);
create index if not exists device_fingerprints_ip_idx
  on public.device_fingerprints(ip_address);
alter table public.device_fingerprints enable row level security;

-- ── fraud_risk_scores ──
create table if not exists public.fraud_risk_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text,
  risk_score integer not null default 0,
  risk_level text not null default 'low',
  signals jsonb,
  last_calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists fraud_risk_scores_score_idx
  on public.fraud_risk_scores(risk_score desc);
alter table public.fraud_risk_scores enable row level security;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fraud_risk_scores_level_check'
  ) then
    alter table public.fraud_risk_scores
      add constraint fraud_risk_scores_level_check
      check (risk_level in ('low', 'moderate', 'high', 'critical'));
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fraud_risk_scores_range_check'
  ) then
    alter table public.fraud_risk_scores
      add constraint fraud_risk_scores_range_check
      check (risk_score between 0 and 100);
  end if;
end $$;

-- ── fraud_flags ──
create table if not exists public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flag_type text not null,
  severity text not null default 'medium',
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index if not exists fraud_flags_user_idx
  on public.fraud_flags(user_id, created_at desc);
create index if not exists fraud_flags_open_idx
  on public.fraud_flags(created_at desc) where resolved_at is null;
alter table public.fraud_flags enable row level security;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fraud_flags_severity_check'
  ) then
    alter table public.fraud_flags
      add constraint fraud_flags_severity_check
      check (severity in ('low', 'medium', 'high', 'critical'));
  end if;
end $$;

-- ── fraud_investigations ──
create table if not exists public.fraud_investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open',
  assigned_admin_id uuid references auth.users(id) on delete set null,
  opened_by uuid references auth.users(id) on delete set null,
  summary text not null,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists fraud_investigations_status_idx
  on public.fraud_investigations(status, created_at desc);
create index if not exists fraud_investigations_user_idx
  on public.fraud_investigations(user_id, created_at desc);
alter table public.fraud_investigations enable row level security;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fraud_investigations_status_check'
  ) then
    alter table public.fraud_investigations
      add constraint fraud_investigations_status_check
      check (status in ('open', 'in_review', 'resolved', 'dismissed'));
  end if;
end $$;
