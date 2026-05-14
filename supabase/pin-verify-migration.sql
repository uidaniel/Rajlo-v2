-- ─────────────────────────────────────────────────────────────────────
-- PIN Verify Ride — rider safety feature
--
-- Riders can opt-in to a 4-digit PIN that the driver must enter at
-- pickup before the trip can start. Prevents the wrong-car problem
-- (common at parish hubs, night pickups, busy events) and mirrors the
-- "Verify Your Ride" pattern from Uber.
--
-- Storage:
--   • profiles.pin_verify_enabled — rider-level toggle (default off)
--   • profiles.pin_verify_mode    — "always" | "night_only"
--   • rides.start_pin             — 4-char string, generated on
--                                   ride request when the rider's
--                                   prefs say it should be required
--   • rides.pin_verified_at       — timestamp the driver entered the
--                                   correct PIN; until non-null the
--                                   arrived→in_progress transition is
--                                   blocked server-side
--   • rides.pin_attempts          — failure counter; 3 wrong entries
--                                   auto-cancels the ride with reason
--                                   "pin_mismatch"
--
-- Idempotent — safe to re-run if columns already exist.
-- ─────────────────────────────────────────────────────────────────────

alter table profiles
  add column if not exists pin_verify_enabled boolean not null default false,
  add column if not exists pin_verify_mode text not null default 'always';

-- Constrain pin_verify_mode to the two allowed values. Use a CHECK
-- constraint rather than an enum so we don't need a migration to add
-- a third mode in future (e.g. "weekends_only").
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_pin_verify_mode_check'
  ) then
    alter table profiles
      add constraint profiles_pin_verify_mode_check
      check (pin_verify_mode in ('always', 'night_only'));
  end if;
end $$;

alter table rides
  add column if not exists start_pin text,
  add column if not exists pin_verified_at timestamptz,
  add column if not exists pin_attempts smallint not null default 0;

-- PIN length sanity check — keeps a corrupt server-side write from
-- shipping a wrong-length code that the driver UI can't enter.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'rides_start_pin_format_check'
  ) then
    alter table rides
      add constraint rides_start_pin_format_check
      check (start_pin is null or start_pin ~ '^[0-9]{4}$');
  end if;
end $$;
