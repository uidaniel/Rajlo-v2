-- ─────────────────────────────────────────────────────────────────────
-- Saved places — quick-tap pickup / drop-off destinations per rider
--
-- The rider request screen surfaces these as chips so common
-- destinations (Home, Office, Mum's, etc.) become a single tap.
-- Each rider can save unlimited entries; the UI focuses the three
-- canonical labels (home / work / office) at the top.
--
-- Schema choices:
--   • `label`     — free-form text (max 32) so riders can name their
--                   own ("Mum's house", "Gym", "Mona Heights"). UI
--                   suggests Home/Work/Office but doesn't enforce.
--   • `kind`      — typed enum-ish so the UI can pick an icon. Defaults
--                   to 'other' so customs render with a generic pin.
--   • `place_name` + `place_address` + `lat`/`lng` — same shape as
--                   the rider's ride pickup/dropoff records, no
--                   translation step when reading.
--   • `place_id`  — Google Places id, kept so re-saving an existing
--                   place can de-dup later if we want.
--
-- RLS: rider can only read/write their own rows. Service role bypasses
-- as normal for admin tooling.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  kind text not null default 'other',
  place_name text not null,
  place_address text not null,
  lat double precision not null,
  lng double precision not null,
  parish text,
  place_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kind constraint — keep the set tight so the UI can rely on it.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'saved_places_kind_check'
  ) then
    alter table saved_places
      add constraint saved_places_kind_check
      check (kind in ('home', 'work', 'office', 'school', 'gym', 'other'));
  end if;
end $$;

-- Length sanity on the user-controlled label (keeps the chip from
-- exploding the request-page header).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'saved_places_label_length_check'
  ) then
    alter table saved_places
      add constraint saved_places_label_length_check
      check (char_length(label) between 1 and 32);
  end if;
end $$;

-- Fast lookup by owner.
create index if not exists saved_places_user_id_idx on saved_places(user_id);

-- One row per (user, kind) for the canonical types so a rider can't
-- accidentally save two "Home"s. Customs ('other') stay unconstrained
-- by design — multiple custom labels are exactly the point.
create unique index if not exists saved_places_user_kind_unique
  on saved_places(user_id, kind)
  where kind <> 'other';

-- updated_at trigger
create or replace function saved_places_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists saved_places_set_updated_at on saved_places;
create trigger saved_places_set_updated_at
  before update on saved_places
  for each row execute function saved_places_touch_updated_at();

-- RLS — each rider sees only their own rows.
alter table saved_places enable row level security;

drop policy if exists saved_places_self_select on saved_places;
create policy saved_places_self_select on saved_places
  for select using (auth.uid() = user_id);

drop policy if exists saved_places_self_insert on saved_places;
create policy saved_places_self_insert on saved_places
  for insert with check (auth.uid() = user_id);

drop policy if exists saved_places_self_update on saved_places;
create policy saved_places_self_update on saved_places
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists saved_places_self_delete on saved_places;
create policy saved_places_self_delete on saved_places
  for delete using (auth.uid() = user_id);
