-- ============================================================================
-- Rajlo Phase 1A — Auth migration
-- Run AFTER the existing schema.sql (already in place from earlier setup).
--
-- What this adds:
--   1. public.profiles  — extends auth.users with full_name, phone, role
--   2. Trigger          — auto-creates a profile row on every Supabase signup
--   3. RLS policies     — users see/update own profile; service_role bypasses
--   4. drivers.user_id  — links existing drivers table to auth accounts
--   5. Helper function  — current_user_role() for use in future RLS policies
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. profiles table ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'rider' check (role in ('rider', 'driver', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- 2. Auto-create profile on signup ----------
-- Pulls full_name / phone / role from the signUp() metadata payload.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'role', 'rider')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 3. RLS on profiles ----------
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- service_role automatically bypasses RLS — no policy needed for admin ops.

-- ---------- 4. Link drivers to auth accounts ----------
alter table public.drivers
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_drivers_user_id on public.drivers(user_id);

-- ---------- 5. Helper for future RLS ----------
-- Used in Phase 2+ to gate ride/booking tables by role.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- Done ----------
-- After running:
--   - Anyone signing up via supabase.auth.signUp() automatically gets a profile.
--   - Their role is read from the metadata; defaults to 'rider' if not provided.
--   - To create an admin account: sign up normally, then run:
--       update public.profiles set role = 'admin' where id = '<that-user-uuid>';
