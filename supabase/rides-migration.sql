-- ============================================================================
-- Rajlo Phase 2A — Ride lifecycle schema
-- Run AFTER auth-migration.sql + storage-migration.sql.
--
-- Three tables:
--   rides         — one row per booking (pickup/dropoff/fare/status timeline)
--   ride_stops    — intermediate waypoints for multi-stop trips, position-ordered
--   ride_events   — append-only audit trail of every status change
--
-- Status state machine:
--   requested → accepted → arrived → in_progress → completed
--                                ↘   cancelled
--
-- RLS gives riders access to their own rides + drivers access to their
-- assigned rides PLUS the public "requested" pool (so they can see + accept
-- pending bookings from the inbox).
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. rides ----------
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,

  status text not null default 'requested'
    check (status in (
      'requested',     -- waiting for a driver to accept
      'accepted',      -- driver assigned, en route to pickup
      'arrived',       -- driver at pickup
      'in_progress',   -- riding
      'completed',     -- trip done
      'cancelled'      -- rider or driver cancelled
    )),

  -- Pickup
  pickup_name        text not null,
  pickup_address     text not null,
  pickup_lat         double precision not null,
  pickup_lng         double precision not null,
  pickup_parish      text,
  pickup_place_id    text,

  -- Dropoff
  dropoff_name       text not null,
  dropoff_address    text not null,
  dropoff_lat        double precision not null,
  dropoff_lng        double precision not null,
  dropoff_parish     text,
  dropoff_place_id   text,

  -- Trip details
  seats              int  not null default 1 check (seats between 1 and 4),
  notes              text,

  -- Fare estimate captured at booking time. final_fare_jmd is filled when
  -- the trip completes (currently set = estimated_fare_jmd by the API
  -- since live metering isn't wired yet — Phase 2A.2 will swap that out).
  estimated_fare_jmd       int not null check (estimated_fare_jmd >= 0),
  estimated_distance_km    numeric(6,2),
  estimated_eta_minutes    int,
  final_fare_jmd           int,

  -- Lifecycle timestamps
  requested_at       timestamptz not null default now(),
  accepted_at        timestamptz,
  arrived_at         timestamptz,
  started_at         timestamptz,
  completed_at       timestamptz,
  cancelled_at       timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rides_rider on public.rides(rider_id);
create index if not exists idx_rides_driver on public.rides(driver_id);
create index if not exists idx_rides_status on public.rides(status);
create index if not exists idx_rides_requested_at on public.rides(requested_at desc);

drop trigger if exists trg_rides_updated_at on public.rides;
create trigger trg_rides_updated_at
  before update on public.rides
  for each row execute function public.set_updated_at();

-- ---------- 2. ride_stops (intermediate waypoints) ----------
create table if not exists public.ride_stops (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  position int not null,         -- 1-indexed order along the route
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  parish text,
  place_id text,
  arrived_at timestamptz,
  departed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ride_stops_ride on public.ride_stops(ride_id, position);

-- ---------- 3. ride_events (audit log) ----------
create table if not exists public.ride_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  event text not null,            -- 'requested' | 'accepted' | 'arrived' | etc.
  actor_role text,                -- 'rider' | 'driver' | 'admin' | 'system'
  actor_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ride_events_ride on public.ride_events(ride_id, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.rides       enable row level security;
alter table public.ride_stops  enable row level security;
alter table public.ride_events enable row level security;

-- ----- rides -----
drop policy if exists "Rider sees own rides" on public.rides;
create policy "Rider sees own rides"
  on public.rides for select
  using (rider_id = auth.uid());

drop policy if exists "Rider creates own rides" on public.rides;
create policy "Rider creates own rides"
  on public.rides for insert
  with check (rider_id = auth.uid());

drop policy if exists "Rider updates own rides" on public.rides;
create policy "Rider updates own rides"
  on public.rides for update
  using (rider_id = auth.uid())
  with check (rider_id = auth.uid());

-- Drivers see rides assigned to them OR open requests (the inbox).
-- "Open request" = status='requested' AND driver_id is null.
drop policy if exists "Driver sees assigned + open rides" on public.rides;
create policy "Driver sees assigned + open rides"
  on public.rides for select
  using (
    driver_id in (
      select id from public.drivers where user_id = auth.uid()
    )
    or (status = 'requested' and driver_id is null)
  );

drop policy if exists "Driver updates own rides" on public.rides;
create policy "Driver updates own rides"
  on public.rides for update
  using (
    driver_id in (select id from public.drivers where user_id = auth.uid())
  )
  with check (
    driver_id in (select id from public.drivers where user_id = auth.uid())
  );

-- ----- ride_stops -----
drop policy if exists "Rider/driver sees own ride stops" on public.ride_stops;
create policy "Rider/driver sees own ride stops"
  on public.ride_stops for select
  using (
    ride_id in (select id from public.rides)   -- relies on rides RLS
  );

drop policy if exists "Rider creates own ride stops" on public.ride_stops;
create policy "Rider creates own ride stops"
  on public.ride_stops for insert
  with check (
    ride_id in (
      select id from public.rides where rider_id = auth.uid()
    )
  );

-- ----- ride_events -----
drop policy if exists "Rider/driver sees own ride events" on public.ride_events;
create policy "Rider/driver sees own ride events"
  on public.ride_events for select
  using (
    ride_id in (select id from public.rides)
  );

-- service_role bypasses RLS — used by the server to insert events,
-- atomically claim rides for drivers, etc.
