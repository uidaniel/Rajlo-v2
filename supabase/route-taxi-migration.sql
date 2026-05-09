-- ============================================================================
-- Rajlo — Route Taxi (Mode B) schema
--
-- Three new tables sit alongside the existing `rides` table (which keeps
-- its meaning: one row per Private Ride / Mode A booking).
--
--   routes            — TA-licensed corridor catalogue (origin ↔ destination).
--                       Seeded from the 2023 TA fare table PDF.
--   driver_sessions   — a driver opens a "session" pinned to one route +
--                       direction; the session counts seats taken and is
--                       what riders match against.
--   route_hails       — one row per rider catching a route taxi. Many hails
--                       attach to one session (many-to-one).
--
-- Pricing comes from `lib/fare-engine.ts` — never hardcode in SQL.
-- All payments settle to the existing wallet ledger; no cash anywhere.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ─────────────── routes ───────────────
-- A TA-licensed corridor between two named places. The fare on the seed
-- row is the official TA-published amount; we keep it alongside the
-- distance so the rider quote can show "TA fare $X" while still letting
-- the engine compute fares for ad-hoc distance from the same constants.
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),

  origin_name        text not null,
  destination_name   text not null,
  origin_parish      text,
  destination_parish text,

  -- Kilometres origin → destination per the TA table.
  distance_km numeric(6,2) not null check (distance_km >= 0),

  -- The fare TA prints for this exact OD pair (their rounding may
  -- differ from `calculateRouteFare(distance_km)` by $10 in edge
  -- cases — we trust the printed value).
  ta_fare_jmd integer not null check (ta_fare_jmd >= 0),

  -- URL-safe handle, e.g. "half-way-tree-to-papine".
  slug text not null unique,

  -- Drivers can only start a session on an active route.
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routes_origin_parish
  on public.routes(origin_parish);
create index if not exists idx_routes_dest_parish
  on public.routes(destination_parish);
create index if not exists idx_routes_active_origin
  on public.routes(active, origin_name);

-- Distinct OD pairs only — no duplicate corridors.
create unique index if not exists ux_routes_origin_destination
  on public.routes(lower(origin_name), lower(destination_name));

drop trigger if exists trg_routes_updated_at on public.routes;
create trigger trg_routes_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();

-- ─────────────── driver_sessions ───────────────
-- A driver activates Mode B by opening a session pinned to a specific
-- route and direction. The session counts seats taken so the matcher
-- can stop pushing hails once the vehicle is full.
create table if not exists public.driver_sessions (
  id uuid primary key default gen_random_uuid(),

  driver_id uuid not null references public.drivers(id) on delete cascade,
  route_id  uuid not null references public.routes(id)  on delete restrict,

  -- 'forward' = origin → destination, 'reverse' = destination → origin.
  -- A driver who finishes a forward leg and turns around opens a NEW
  -- session in the reverse direction (cleaner audit trail than mutating).
  direction text not null check (direction in ('forward', 'reverse')),

  -- Total seats the vehicle has for paying passengers (driver excluded).
  vehicle_capacity integer not null default 4
    check (vehicle_capacity between 1 and 16),

  -- Cached count of currently-onboard passengers (sum of route_hails
  -- where status in ('accepted','picked_up') for this session). Kept
  -- in sync by a trigger on route_hails.
  seats_taken integer not null default 0
    check (seats_taken >= 0),

  -- Last known driver position — refreshed by the live-trip tracker.
  current_lat double precision,
  current_lng double precision,
  last_position_at timestamptz,

  status text not null default 'active'
    check (status in ('active', 'paused', 'ended')),

  started_at timestamptz not null default now(),
  ended_at   timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_driver_sessions_route_active
  on public.driver_sessions(route_id, status)
  where status = 'active';
create index if not exists idx_driver_sessions_driver_active
  on public.driver_sessions(driver_id, status);

-- A driver can only have one active session at a time (any direction,
-- any route). Ending the current session is the prerequisite to start
-- a new one — this catches double-tap "Start session" bugs at the DB
-- layer.
create unique index if not exists ux_driver_sessions_one_active_per_driver
  on public.driver_sessions(driver_id)
  where status = 'active';

drop trigger if exists trg_driver_sessions_updated_at on public.driver_sessions;
create trigger trg_driver_sessions_updated_at
  before update on public.driver_sessions
  for each row execute function public.set_updated_at();

-- ─────────────── route_hails ───────────────
-- A rider's request to board a route taxi. Created on hail, attached to
-- a session when a driver accepts, debited from rider's wallet on
-- pickup or completion (chosen later — for now we charge on completion
-- to match the cash-equivalent UX where you pay when getting off).
create table if not exists public.route_hails (
  id uuid primary key default gen_random_uuid(),

  rider_id   uuid not null references auth.users(id) on delete cascade,
  route_id   uuid not null references public.routes(id) on delete restrict,
  session_id uuid references public.driver_sessions(id) on delete set null,

  -- Where the rider is hailing from + going to. May lie on the route
  -- between origin and destination (a "leg") rather than the full corridor.
  pickup_name    text not null,
  pickup_lat     double precision not null,
  pickup_lng     double precision not null,
  pickup_parish  text,

  dropoff_name   text not null,
  dropoff_lat    double precision not null,
  dropoff_lng    double precision not null,
  dropoff_parish text,

  -- Distance + fare locked at hail time so the rider sees a stable
  -- quote even if the geometry recalculates later.
  distance_km   numeric(6,2) not null check (distance_km >= 0),
  fare_jmd      integer not null check (fare_jmd >= 0),

  -- For the half-fare concessions (children/students/disabled/seniors).
  -- The wallet debit at completion uses fare_jmd, and `concession`
  -- being true means the original full fare was halved per TA rules.
  concession boolean not null default false,

  status text not null default 'requested'
    check (status in (
      'requested',  -- rider hailed; no session yet
      'accepted',   -- driver of an active session accepted; rider counted in seats_taken
      'picked_up',  -- rider boarded
      'completed',  -- rider dropped off; wallet charged
      'cancelled',  -- rider or driver cancelled before pickup
      'no_show'     -- driver arrived, rider didn't board within window
    )),

  cancellation_reason text,

  -- Wallet transaction that actually moved the money. NULL until
  -- completion. We point at the txn rather than re-storing the amount
  -- so reconciliation is one query.
  charged_transaction_id uuid references public.wallet_transactions(id),

  requested_at timestamptz not null default now(),
  accepted_at  timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_route_hails_rider
  on public.route_hails(rider_id, requested_at desc);
create index if not exists idx_route_hails_session
  on public.route_hails(session_id);
create index if not exists idx_route_hails_route_pending
  on public.route_hails(route_id)
  where status = 'requested';
create index if not exists idx_route_hails_session_active
  on public.route_hails(session_id, status)
  where status in ('accepted', 'picked_up');

drop trigger if exists trg_route_hails_updated_at on public.route_hails;
create trigger trg_route_hails_updated_at
  before update on public.route_hails
  for each row execute function public.set_updated_at();

-- ─────────────── seats_taken sync ───────────────
-- Recompute seats_taken on the parent session whenever a hail row
-- moves into or out of an "onboard" state. Keeps the cache honest
-- even if multiple hails change concurrently.
create or replace function public.recompute_session_seats_taken()
returns trigger language plpgsql as $$
declare
  affected_session uuid;
begin
  affected_session := coalesce(new.session_id, old.session_id);
  if affected_session is null then
    return coalesce(new, old);
  end if;

  update public.driver_sessions
     set seats_taken = (
       select count(*)
         from public.route_hails
        where session_id = affected_session
          and status in ('accepted', 'picked_up')
     ),
     updated_at = now()
   where id = affected_session;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_route_hails_seats_sync on public.route_hails;
create trigger trg_route_hails_seats_sync
  after insert or update of status, session_id or delete
  on public.route_hails
  for each row execute function public.recompute_session_seats_taken();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.routes           enable row level security;
alter table public.driver_sessions  enable row level security;
alter table public.route_hails      enable row level security;

-- Routes: anyone signed-in can read the catalogue. Writes via service-role.
drop policy if exists "Anyone reads routes" on public.routes;
create policy "Anyone reads routes"
  on public.routes for select
  using (active = true);

drop policy if exists "Admins read all routes" on public.routes;
create policy "Admins read all routes"
  on public.routes for select
  using (
    exists (select 1 from public.profiles
             where profiles.id = auth.uid() and profiles.role = 'admin')
  );

-- Driver sessions: drivers read their own + active sessions for the
-- route they're currently looking at. Riders read active sessions on
-- routes they're hailing (for ETAs / "next car"). Admins read all.
drop policy if exists "Drivers read own sessions" on public.driver_sessions;
create policy "Drivers read own sessions"
  on public.driver_sessions for select
  using (
    driver_id in (
      select id from public.drivers where user_id = auth.uid()
    )
  );

drop policy if exists "Riders read active sessions" on public.driver_sessions;
create policy "Riders read active sessions"
  on public.driver_sessions for select
  using (status = 'active');

drop policy if exists "Admins read all sessions" on public.driver_sessions;
create policy "Admins read all sessions"
  on public.driver_sessions for select
  using (
    exists (select 1 from public.profiles
             where profiles.id = auth.uid() and profiles.role = 'admin')
  );

-- Route hails: rider reads own + the assigned driver reads. Admins all.
drop policy if exists "Riders read own hails" on public.route_hails;
create policy "Riders read own hails"
  on public.route_hails for select
  using (rider_id = auth.uid());

drop policy if exists "Drivers read assigned hails" on public.route_hails;
create policy "Drivers read assigned hails"
  on public.route_hails for select
  using (
    session_id in (
      select s.id
        from public.driver_sessions s
        join public.drivers d on d.id = s.driver_id
       where d.user_id = auth.uid()
    )
  );

drop policy if exists "Admins read all hails" on public.route_hails;
create policy "Admins read all hails"
  on public.route_hails for select
  using (
    exists (select 1 from public.profiles
             where profiles.id = auth.uid() and profiles.role = 'admin')
  );
