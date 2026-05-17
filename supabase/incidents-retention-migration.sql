-- ─────────────────────────────────────────────────────────────────────
-- Incident reporting & record retention
--
-- Implements the RAJLO Incident Reporting & Record Retention spec —
-- the structured evidence trail for safety incidents, complaints,
-- platform abuse, and technical incidents.
--
--   incidents           — one report. Carries the rider/driver/trip
--                         linkage, severity, status workflow, and the
--                         resolution.
--   incident_evidence   — files / screenshots / chat logs attached to
--                         an incident.
--   incident_audit_logs — append-only trail of every action on an
--                         incident (created, status change, note,
--                         evidence added, closed).
--   support_notes       — admin notes on an incident (internal or
--                         shared).
--
-- Retention: every user reference is `on delete set null`, never
-- cascade — an incident record outlives the accounts it concerns, as
-- the spec requires (legal defence, insurance, regulator review).
-- Nothing here is hard-deleted by the app.
--
-- RLS: `incidents` lets a user read the incidents they reported;
-- everything else is service-role-only (admin tooling). Idempotent.
-- ─────────────────────────────────────────────────────────────────────

-- ── incidents ──
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_type text not null,
  severity_level text not null default 'medium',
  status text not null default 'open',
  rider_id uuid references auth.users(id) on delete set null,
  driver_id uuid references auth.users(id) on delete set null,
  trip_id text,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_role text,
  assigned_admin_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text not null,
  -- Context snapshot captured at report time (platform, app version,
  -- pickup/dropoff, GPS, etc.) — preserved even if the trip changes.
  context jsonb,
  incident_timestamp timestamptz,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_summary text,
  action_taken text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists incidents_status_idx
  on public.incidents(status, reported_at desc);
create index if not exists incidents_reporter_idx
  on public.incidents(reporter_user_id, reported_at desc);
alter table public.incidents enable row level security;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'incidents_severity_check'
  ) then
    alter table public.incidents
      add constraint incidents_severity_check
      check (severity_level in ('low', 'medium', 'high', 'critical'));
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'incidents_status_check'
  ) then
    alter table public.incidents
      add constraint incidents_status_check
      check (status in (
        'open', 'under_review', 'awaiting_response',
        'escalated', 'resolved', 'closed'
      ));
  end if;
end $$;

-- A reporter can read the incidents they filed (to see status). All
-- writes + all admin reads go through the service-role key.
drop policy if exists incidents_reporter_select on public.incidents;
create policy incidents_reporter_select on public.incidents
  for select using (auth.uid() = reporter_user_id);

-- ── incident_evidence ──
create table if not exists public.incident_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  evidence_type text not null,
  file_url text,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  metadata jsonb
);
create index if not exists incident_evidence_incident_idx
  on public.incident_evidence(incident_id);
alter table public.incident_evidence enable row level security;

-- ── incident_audit_logs ──
create table if not exists public.incident_audit_logs (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  action_type text not null,
  action_description text not null,
  admin_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists incident_audit_logs_incident_idx
  on public.incident_audit_logs(incident_id, created_at desc);
alter table public.incident_audit_logs enable row level security;

-- ── support_notes ──
create table if not exists public.support_notes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_label text,
  note_text text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists support_notes_incident_idx
  on public.support_notes(incident_id, created_at desc);
alter table public.support_notes enable row level security;
