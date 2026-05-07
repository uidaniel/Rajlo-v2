-- ============================================================================
-- Rajlo Phase 2A.3 — Ride-sharing / carpool matching
-- Run AFTER rides-migration.sql.
--
-- Adds the ability to match two compatible ride requests into a single
-- carpool: both riders share one driver, the route covers both pickups
-- and dropoffs in sequence, and each rider's fare is reduced because
-- the trip cost is amortised.
--
-- Data model: ONE rides row per rider (existing schema unchanged), plus
-- a `carpool_groups` parent row that links them. This keeps the
-- existing ride lifecycle / RLS / Realtime plumbing identical for
-- solo rides — carpool is purely additive.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. carpool_groups ----------
-- One row per matched pair of riders.
create table if not exists public.carpool_groups (
  id uuid primary key default gen_random_uuid(),
  -- Group lifecycle, distinct from per-ride status. We don't really
  -- *need* this column for v1 (the per-ride statuses tell you
  -- everything), but it gives us a single hook for "the whole group
  -- went sour, dissolve it" later.
  status text not null default 'matched'
    check (status in ('matched', 'dispatched', 'completed', 'dissolved')),
  -- Cached driver_id once any ride in the group is accepted. Lets us
  -- query "what's the driver currently carrying" without a join.
  driver_id uuid references public.drivers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_carpool_groups_updated_at on public.carpool_groups;
create trigger trg_carpool_groups_updated_at
  before update on public.carpool_groups
  for each row execute function public.set_updated_at();

-- ---------- 2. Extend `rides` ----------
-- `allow_carpool`     — rider's opt-in, set at booking time
-- `carpool_group_id`  — FK once matched
-- `carpool_role`      — 'primary' (older ride) or 'secondary' (newer)
--                       used to define route ordering: primary pickup
--                       first, then secondary pickup, primary dropoff,
--                       secondary dropoff (or some agreed sequence)
alter table public.rides
  add column if not exists allow_carpool boolean not null default false;

alter table public.rides
  add column if not exists carpool_group_id uuid
    references public.carpool_groups(id) on delete set null;

alter table public.rides
  add column if not exists carpool_role text
    check (carpool_role is null or carpool_role in ('primary', 'secondary'));

create index if not exists idx_rides_carpool_group
  on public.rides(carpool_group_id);

-- Rides that are open candidates for matching: requested + opted in +
-- not yet matched. Used by the matcher's lookup query, partial-indexed
-- so it stays cheap as the rides table grows.
create index if not exists idx_rides_carpool_open
  on public.rides(requested_at desc)
  where status = 'requested'
    and allow_carpool = true
    and carpool_group_id is null;

-- ============================================================================
-- RLS — extend existing policies to cover the new column shape.
-- ============================================================================
alter table public.carpool_groups enable row level security;

-- Riders see groups that contain one of THEIR rides.
drop policy if exists "Rider sees own carpool group" on public.carpool_groups;
create policy "Rider sees own carpool group"
  on public.carpool_groups for select
  using (
    id in (
      select carpool_group_id
      from public.rides
      where rider_id = auth.uid()
        and carpool_group_id is not null
    )
  );

-- Drivers see groups they've been assigned (driver_id = their drivers.id).
drop policy if exists "Driver sees assigned carpool group" on public.carpool_groups;
create policy "Driver sees assigned carpool group"
  on public.carpool_groups for select
  using (
    driver_id in (select id from public.drivers where user_id = auth.uid())
  );

-- service_role inserts/updates the group (matcher + accept handler).

-- ============================================================================
-- Realtime — let clients see status flips on the group row.
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.carpool_groups;
  end if;
exception
  when duplicate_object then null;
end $$;
