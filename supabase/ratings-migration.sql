-- ============================================================================
-- Rajlo Phase 2A — Ride ratings
-- Run AFTER rides-migration.sql.
--
-- One row per (ride, rating-direction). For now only riders rate drivers,
-- but the table is designed for bidirectional rating from day one — driver
-- rates rider can land later by reusing the same shape.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.ride_ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  -- Direction of the rating. `rider→driver` is rider rating their driver,
  -- `driver→rider` (future) is driver rating their rider. Stored as
  -- separate role columns so we can index + query each direction
  -- independently rather than parsing a combined enum.
  rater_role text not null check (rater_role in ('rider', 'driver')),
  -- auth.users.id of whoever submitted the rating.
  rater_id uuid not null references auth.users(id) on delete cascade,
  -- The party being rated. We could derive this from the ride row but
  -- denormalising means "compute average rating for driver X" is a
  -- one-table scan instead of a join — cheap to keep current via the
  -- API endpoint that inserts the row.
  rated_role text not null check (rated_role in ('rider', 'driver')),
  rated_id uuid not null references auth.users(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- A rater can only submit once per ride per direction. Riders can't
  -- rate the same driver twice for the same trip; future driver-rates-
  -- rider will get its own row.
  unique (ride_id, rater_role)
);

-- For "list this user's ratings of others" — used by the audit screen.
create index if not exists idx_ride_ratings_rater
  on public.ride_ratings(rater_id, created_at desc);

-- For "compute this driver's average rating" — by far the hot query.
-- Sized to the rated party + role so we can pull just the driver's
-- ratings without scanning rider ratings.
create index if not exists idx_ride_ratings_rated
  on public.ride_ratings(rated_id, rated_role);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.ride_ratings enable row level security;

-- The rater can see what they wrote.
drop policy if exists "Rater sees own ratings" on public.ride_ratings;
create policy "Rater sees own ratings"
  on public.ride_ratings for select
  using (rater_id = auth.uid());

-- The party being rated can see ratings about themselves.
drop policy if exists "Rated party sees own ratings" on public.ride_ratings;
create policy "Rated party sees own ratings"
  on public.ride_ratings for select
  using (rated_id = auth.uid());

-- Insert: only the rater themselves can submit, and we additionally
-- enforce the `ride_id` belongs to a ride they were on. The
-- belongs-to check is done in the API endpoint with service_role —
-- doing it in RLS would require an EXISTS subquery on every insert
-- which is fine for low volume but the API path is clearer.
drop policy if exists "Rater inserts own ratings" on public.ride_ratings;
create policy "Rater inserts own ratings"
  on public.ride_ratings for insert
  with check (rater_id = auth.uid());

-- service_role bypasses RLS for the rating API endpoint.
