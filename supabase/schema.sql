create extension if not exists pgcrypto;

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  first_name text,
  last_name text,
  phone text,
  email text,
  trn text,
  nis text,
  licence_number text,
  plate_number text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  onboarding_status text not null default 'pending_review',
  activated boolean not null default false,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  doc_key text not null,
  label text not null,
  description text,
  renewal_period_days integer not null default 0,
  expires_on date,
  status text not null default 'pending',
  note text,
  file_name text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(driver_id, doc_key),
  constraint driver_documents_status_check check (status in ('approved', 'pending', 'rejected', 'missing', 'expiring_soon', 'expired'))
);

create table if not exists public.driver_audit_logs (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  actor_role text not null,
  actor_id text,
  event text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_drivers_external_id on public.drivers(external_id);
create index if not exists idx_driver_documents_driver_id on public.driver_documents(driver_id);
create index if not exists idx_driver_documents_status on public.driver_documents(status);
create index if not exists idx_driver_audit_logs_driver_id_created on public.driver_audit_logs(driver_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_drivers_updated_at on public.drivers;
create trigger trg_drivers_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

drop trigger if exists trg_driver_documents_updated_at on public.driver_documents;
create trigger trg_driver_documents_updated_at
before update on public.driver_documents
for each row execute function public.set_updated_at();
