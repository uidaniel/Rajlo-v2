-- ─────────────────────────────────────────────────────────────────────
-- Consent evidence hardening
--
-- Strengthens the legal-evidence value of the consent ledger so a
-- recorded acceptance can prove not just THAT a user accepted, but the
-- exact TEXT they accepted and the device class they accepted from.
--
-- 1. legal_acceptances gains:
--      content_hash  — SHA-256 of the exact policy body the user
--                      accepted. Lets RAJLO prove "this user agreed to
--                      precisely this wording", not just a version
--                      label.
--      platform      — coarse device class (web / android / ios)
--                      derived from the request user-agent.
--
-- 2. legal_document_versions — an append-only archive of every policy
--    version ever PUBLISHED from the admin panel. When an admin
--    publishes an edit, the new version's full text is archived here
--    before it can ever be overwritten by a later edit. Combined with
--    the committed `policies/*.txt` baseline (which covers
--    never-edited versions), this guarantees the text behind every
--    content_hash is permanently recoverable.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

alter table legal_acceptances
  add column if not exists content_hash text;

alter table legal_acceptances
  add column if not exists platform text;

-- Append-only archive of published policy versions.
create table if not exists legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  doc_key text not null,
  version text not null,
  title text not null,
  body text not null,
  content_hash text not null,
  archived_at timestamptz not null default now(),
  archived_by uuid references auth.users(id) on delete set null
);

-- One archived row per (document, version). Re-publishing the same
-- version is a no-op against this index (upsert ignore-duplicates).
create unique index if not exists legal_document_versions_key_version_unique
  on legal_document_versions(doc_key, version);

-- Public-readable: the archived text behind a content_hash is, like
-- the live policy, public information — and the consent-evidence
-- export needs to read it. Writes happen only via the service-role
-- key (the admin publish endpoint).
alter table legal_document_versions enable row level security;

drop policy if exists legal_document_versions_public_read on legal_document_versions;
create policy legal_document_versions_public_read on legal_document_versions
  for select using (true);
