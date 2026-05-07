-- ============================================================================
-- Rajlo Phase 1D — Google OAuth support
-- Run AFTER auth-migration.sql.
--
-- What this adds:
--   1. profiles.avatar_url        — stores the user's profile picture URL
--   2. handle_new_user()  (replaces) — copies avatar_url + name from auth
--                                       metadata at signup (Google or email)
--   3. handle_user_metadata_update — keeps avatar_url + full_name in sync
--                                     when Google refreshes the metadata on
--                                     each subsequent sign-in
--
-- Why a second trigger: Google rewrites raw_user_meta_data every time the
-- user signs in (e.g. if they changed their Google profile picture). Without
-- the UPDATE trigger, the sidebar would display a stale avatar forever.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_url text;

-- ---------- 1. Updated new-user trigger ----------
-- Now also pulls avatar_url. Google sends it under 'avatar_url' (Supabase's
-- normalized key) but we also accept 'picture' (Google's raw key) as a
-- defensive fallback in case the OAuth provider config changes upstream.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'role', 'rider'),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------- 2. Re-sync trigger on metadata update ----------
-- Only updates fields auth controls (avatar + name). Never touches role or
-- phone, since those can be edited by the user inside the app and we don't
-- want OAuth to overwrite them.
create or replace function public.handle_user_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data is distinct from old.raw_user_meta_data then
    update public.profiles
      set
        avatar_url = coalesce(
          new.raw_user_meta_data ->> 'avatar_url',
          new.raw_user_meta_data ->> 'picture',
          avatar_url
        ),
        full_name = coalesce(
          full_name,
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name'
        )
      where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_metadata_update();

-- ---------- Done ----------
-- After running:
--   - New Google sign-ups get their avatar saved automatically.
--   - Returning users get their avatar refreshed on every sign-in.
--   - Email/password signups still work the same (avatar_url stays null).
--   - The sidebar will render <img> if avatar_url is set, else fall back
--     to initials — handled in src/components/mobile-drawer.tsx.
