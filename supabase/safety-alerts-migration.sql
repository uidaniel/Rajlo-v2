-- ============================================================================
-- Rajlo Phase 2A.2.d — Safety toolkit
--
-- Two tables:
--   safety_alerts   — rider raises a panic event during a trip; admins triage
--   trip_share_links — rider generates a tokenised public-read URL their
--                      friend can open to watch the trip without a Rajlo
--                      account. Token-only access, no PII beyond what the
--                      rider already chose to share.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. safety_alerts ----------
create table if not exists public.safety_alerts (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,

  -- 'sos'   = panic / emergency, expects ops to call back ASAP
  -- 'flag'  = something feels off but no immediate danger
  kind text not null check (kind in ('sos', 'flag')),

  -- Optional context the rider typed before submitting.
  message text,

  -- Coords captured at submission time so ops can see where the rider was.
  lat double precision,
  lng double precision,

  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),

  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_safety_alerts_ride on public.safety_alerts(ride_id);
create index if not exists idx_safety_alerts_status on public.safety_alerts(status, created_at desc);

drop trigger if exists trg_safety_alerts_updated_at on public.safety_alerts;
create trigger trg_safety_alerts_updated_at
  before update on public.safety_alerts
  for each row execute function public.set_updated_at();

alter table public.safety_alerts enable row level security;

drop policy if exists "Rider creates own alerts" on public.safety_alerts;
create policy "Rider creates own alerts"
  on public.safety_alerts for insert
  with check (rider_id = auth.uid());

drop policy if exists "Rider sees own alerts" on public.safety_alerts;
create policy "Rider sees own alerts"
  on public.safety_alerts for select
  using (rider_id = auth.uid());

-- Admin reads + writes go through service_role, which bypasses RLS — no
-- admin SELECT policy needed.

-- ---------- 2. trip_share_links ----------
-- A rider can generate a one-off link their friend opens to watch the trip
-- live. The token is the only auth — keep it long + random. Expires
-- automatically when the ride ends (not enforced at the DB level; the
-- public-read endpoint checks ride status).
create table if not exists public.trip_share_links (
  token text primary key,
  ride_id uuid not null references public.rides(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete cascade,
  -- Optional label so the rider remembers who they sent which link to.
  recipient_label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_trip_share_links_ride on public.trip_share_links(ride_id);

alter table public.trip_share_links enable row level security;

drop policy if exists "Rider creates own share links" on public.trip_share_links;
create policy "Rider creates own share links"
  on public.trip_share_links for insert
  with check (rider_id = auth.uid());

drop policy if exists "Rider sees own share links" on public.trip_share_links;
create policy "Rider sees own share links"
  on public.trip_share_links for select
  using (rider_id = auth.uid());

drop policy if exists "Rider revokes own share links" on public.trip_share_links;
create policy "Rider revokes own share links"
  on public.trip_share_links for update
  using (rider_id = auth.uid())
  with check (rider_id = auth.uid());

-- The public-read endpoint that resolves a token uses service_role, so we
-- don't need a public SELECT policy.
