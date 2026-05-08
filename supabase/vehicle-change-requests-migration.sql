-- ============================================================================
-- Rajlo Phase 2A — Vehicle catalog + change requests
-- Run AFTER schema.sql + onboarding-fields-migration.sql.
--
-- Two changes:
--
--   1. `drivers.vehicle_type` column (Sedan / SUV / Crossover / etc.) —
--      we already have make/model/year/colour but not the body type
--      class. Riders see this on the trip card so they know whether
--      to expect a wagon or a hatch.
--
--   2. `vehicle_change_requests` table — drivers can no longer
--      self-edit vehicle fields once verified. Instead they submit
--      a change request with new documents (insurance, registration,
--      COF) for the new vehicle. An admin reviews and either applies
--      the changes (which updates the drivers row + stores the new
--      docs) or rejects with a note.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. drivers.vehicle_type ----------
alter table public.drivers
  add column if not exists vehicle_type text;

-- ---------- 2. vehicle_change_requests ----------
create table if not exists public.vehicle_change_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,

  -- Status state machine. `pending` = waiting on admin review.
  -- `approved` = admin approved + drivers row was updated. `rejected`
  -- = admin rejected with a note for the driver. `cancelled` =
  -- driver withdrew their own request before review.
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),

  -- Requested vehicle spec — flat fields (rather than a JSONB blob)
  -- so the admin queue can sort + filter on them in plain SQL.
  requested_type   text not null,
  requested_brand  text not null,
  requested_model  text not null,
  requested_year   integer not null,
  requested_color  text not null,
  requested_plate  text,

  -- Document storage paths in the driver-documents bucket. Each
  -- holds the storage key for the new doc covering this vehicle.
  -- Null is allowed for the doc keys at request time but the API
  -- enforces presence before submission.
  insurance_path     text,
  registration_path  text,
  cof_path           text,

  -- Driver-submitted note — why they're changing (sold old car,
  -- wreck, family upgrade). Helps the admin's read.
  note text,

  -- Admin review trail.
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users(id) on delete set null,
  admin_note       text,

  submitted_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_vehicle_change_requests_updated_at
  on public.vehicle_change_requests;
create trigger trg_vehicle_change_requests_updated_at
  before update on public.vehicle_change_requests
  for each row execute function public.set_updated_at();

create index if not exists idx_vehicle_change_requests_driver
  on public.vehicle_change_requests(driver_id, submitted_at desc);

-- Hot index for the admin queue: pending requests, oldest first.
create index if not exists idx_vehicle_change_requests_pending
  on public.vehicle_change_requests(submitted_at)
  where status = 'pending';

-- A driver can only have ONE pending request at a time. Enforced
-- via a partial unique index — multiple historical (approved /
-- rejected / cancelled) records are fine, but two open ones are
-- not.
create unique index if not exists idx_vehicle_change_requests_one_open
  on public.vehicle_change_requests(driver_id)
  where status = 'pending';

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.vehicle_change_requests enable row level security;

-- Drivers see / create / cancel their OWN requests.
drop policy if exists "Driver sees own change requests"
  on public.vehicle_change_requests;
create policy "Driver sees own change requests"
  on public.vehicle_change_requests for select
  using (
    driver_id in (select id from public.drivers where user_id = auth.uid())
  );

drop policy if exists "Driver creates own change requests"
  on public.vehicle_change_requests;
create policy "Driver creates own change requests"
  on public.vehicle_change_requests for insert
  with check (
    driver_id in (select id from public.drivers where user_id = auth.uid())
  );

drop policy if exists "Driver cancels own change requests"
  on public.vehicle_change_requests;
create policy "Driver cancels own change requests"
  on public.vehicle_change_requests for update
  using (
    driver_id in (select id from public.drivers where user_id = auth.uid())
  )
  with check (
    driver_id in (select id from public.drivers where user_id = auth.uid())
  );

-- Admins see ALL change requests.
drop policy if exists "Admins see all change requests"
  on public.vehicle_change_requests;
create policy "Admins see all change requests"
  on public.vehicle_change_requests for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- service_role inserts the audit + applies approved changes via
-- the dedicated API endpoint.
