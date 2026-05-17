-- ─────────────────────────────────────────────────────────────────────
-- Internal admin RBAC + security controls
--
-- Implements the RAJLO Internal Admin Access & Security Controls spec.
-- Until now "admin" was one flat role; this introduces a 5-tier
-- privilege model and the governance tables that record who did what.
--
-- profiles gains:
--   admin_role       — the granular tier for a user whose role='admin'
--                      (support_agent | moderator | compliance |
--                       technical_admin | super_admin). NULL for
--                      non-admins. The actual permission each tier
--                      grants is defined in code (src/lib/admin-rbac.ts)
--                      — keeping the matrix in code makes it
--                      version-controlled and un-tamperable from the DB.
--   admin_suspended  — when true, the admin is locked out of the admin
--                      surface entirely (requireAdmin rejects them).
--
-- New tables:
--   admin_access_logs       — an entry each time an admin's session is
--                             first seen (the admin portal beacons it).
--   admin_security_events   — privileged / notable admin events
--                             (role changes, admin suspensions, …).
--   admin_permission_changes— a focused before/after trail of every
--                             admin-role change.
--
-- All three are append-only governance records — never updated or
-- deleted by the app. RLS is enabled with no policies, so they're
-- reachable only through the service-role key (the admin API).
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

-- ── profiles: granular admin tier + suspension flag ──
alter table public.profiles
  add column if not exists admin_role text;

alter table public.profiles
  add column if not exists admin_suspended boolean not null default false;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_admin_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_admin_role_check
      check (
        admin_role is null
        or admin_role in (
          'support_agent', 'moderator', 'compliance',
          'technical_admin', 'super_admin'
        )
      );
  end if;
end $$;

-- Every CURRENT admin becomes a super_admin so nothing they could do
-- before this migration suddenly breaks. New, narrower tiers are then
-- assigned deliberately from the admin panel.
update public.profiles
  set admin_role = 'super_admin'
  where role = 'admin' and admin_role is null;

-- ── admin_access_logs ──
create table if not exists public.admin_access_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists admin_access_logs_admin_idx
  on public.admin_access_logs(admin_user_id, created_at desc);
alter table public.admin_access_logs enable row level security;

-- ── admin_security_events ──
create table if not exists public.admin_security_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_security_events_created_idx
  on public.admin_security_events(created_at desc);
alter table public.admin_security_events enable row level security;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'admin_security_events_severity_check'
  ) then
    alter table public.admin_security_events
      add constraint admin_security_events_severity_check
      check (severity in ('info', 'warning', 'critical'));
  end if;
end $$;

-- ── admin_permission_changes ──
create table if not exists public.admin_permission_changes (
  id uuid primary key default gen_random_uuid(),
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_label text,
  target_admin_id uuid not null references auth.users(id) on delete cascade,
  target_label text,
  previous_role text,
  new_role text,
  created_at timestamptz not null default now()
);
create index if not exists admin_permission_changes_target_idx
  on public.admin_permission_changes(target_admin_id, created_at desc);
alter table public.admin_permission_changes enable row level security;
