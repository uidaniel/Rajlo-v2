-- ============================================================================
-- Rajlo Phase 2A — User profile avatars
-- Run AFTER auth-migration.sql.
--
-- Creates a PUBLIC `avatars` bucket where both riders and drivers can
-- upload a profile picture. Users upload to their own auth.user_id
-- folder; the resulting URL is plain public (no signing) so the
-- sidebar / rider-facing surfaces don't pay a per-render signing cost.
--
-- Why public (vs the private `driver-documents` bucket): avatar URLs
-- are essentially low-sensitivity — riders see drivers' avatars
-- everywhere, and drivers see other drivers' selfies on rider rides.
-- Putting them behind a signed-URL workflow adds complexity for no
-- privacy benefit. Driver TA-verified selfies stay in the private
-- bucket because those are compliance-grade documents.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. Bucket (public) ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---------- 2. RLS policies on storage.objects ----------
-- Convention: every avatar is stored under <auth.user_id>/<file>
-- so policies scope by the leading folder.

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read — bucket is public so unauthenticated users (the
-- public trip-share view) can also load avatars. The policy is
-- redundant on a public bucket but kept for documentation.
drop policy if exists "Anyone can read avatars" on storage.objects;
create policy "Anyone can read avatars"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
