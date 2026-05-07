-- ============================================================================
-- Rajlo Phase 1B — Storage migration
-- Run AFTER auth-migration.sql.
--
-- What this does:
--   1. Creates the `driver-documents` Storage bucket (private)
--   2. RLS on storage.objects:
--      - Drivers can UPLOAD/READ/DELETE files in their own user_id folder
--      - Admins can READ all driver documents
--      - service_role (server) bypasses RLS automatically
--   3. Adds `file_path` column to public.driver_documents
--
-- Convention: every file is stored under   <auth.user_id>/<file>
-- so the RLS policies can scope by `(storage.foldername(name))[1]`.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. Bucket (private) ----------
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;

-- ---------- 2. RLS policies on storage.objects ----------
-- (RLS is already enabled by Supabase on the storage schema by default.)

drop policy if exists "Drivers can upload own documents" on storage.objects;
create policy "Drivers can upload own documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Drivers can read own documents" on storage.objects;
create policy "Drivers can read own documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Drivers can replace own documents" on storage.objects;
create policy "Drivers can replace own documents"
on storage.objects for update
to authenticated
using (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Drivers can delete own documents" on storage.objects;
create policy "Drivers can delete own documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins can read all driver documents" on storage.objects;
create policy "Admins can read all driver documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'driver-documents'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- ---------- 3. driver_documents.file_path ----------
-- Stores the storage key (path within bucket). file_name keeps the human
-- name. The actual file URL is signed on-demand server-side for admin viewing.
alter table public.driver_documents
  add column if not exists file_path text;

-- ---------- Done ----------
-- After running:
--   - Drivers will upload to driver-documents/<their-user-id>/<doc>-<ts>.<ext>
--   - Admins can list all paths via service_role; signed URLs expire after a
--     short time so they aren't share-able once leaked.
