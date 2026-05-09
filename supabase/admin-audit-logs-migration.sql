-- ============================================================================
-- Rajlo — Admin audit logs
--
-- Captures every admin action that mutates state (deactivating a rider,
-- deleting a user, suspending a driver, etc.) so the platform has a
-- single immutable trail for compliance + post-incident review.
--
-- Driver-specific decisions still flow into `driver_audit_logs` (kept
-- for backwards compatibility with the existing verification timeline);
-- this table is the catch-all for everything else and the system-wide
-- "what did admin X do this week" view.
--
-- Each row captures:
--   actor_id      — auth.users.id of the admin who performed the action
--   actor_label   — denormalised display name so the audit log keeps
--                    making sense even after the admin profile changes
--   target_type   — 'rider' | 'driver' | 'admin' | 'ride' | 'system'
--   target_id     — text so we can store either uuid or external_id
--   target_label  — denormalised display name for the same reason
--   action        — short verb-ish identifier ('deactivate', 'delete',
--                    'invite', 'role_change', 'suspend', etc.)
--   summary       — human-readable one-liner shown in the UI
--   metadata      — jsonb for extra context (reason, before/after, etc.)
--
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),

  actor_id uuid references auth.users(id) on delete set null,
  actor_label text,

  target_type text not null
    check (target_type in ('rider', 'driver', 'admin', 'ride', 'system')),
  target_id text,
  target_label text,

  action text not null,
  summary text not null,
  metadata jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at
  on public.admin_audit_logs(created_at desc);

create index if not exists idx_admin_audit_logs_target
  on public.admin_audit_logs(target_type, target_id, created_at desc);

create index if not exists idx_admin_audit_logs_actor
  on public.admin_audit_logs(actor_id, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.admin_audit_logs enable row level security;

-- Admins can read every row. service_role bypasses RLS for inserts.
drop policy if exists "Admins read audit logs" on public.admin_audit_logs;
create policy "Admins read audit logs"
  on public.admin_audit_logs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
