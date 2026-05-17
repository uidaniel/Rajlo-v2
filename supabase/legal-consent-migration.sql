-- ─────────────────────────────────────────────────────────────────────
-- Legal consent ledger — timestamped record of every policy a user
-- has accepted.
--
-- One row = one user accepting one document at one version. This is
-- the legally-load-bearing table: it's what proves, in a dispute, that
-- a specific person agreed to a specific version of a specific policy
-- at a specific time, from a specific device/IP.
--
-- Design:
--   • `doc_key`     — matches a key in src/lib/legal-documents.ts
--                     (e.g. 'terms-of-service', 'driver-agreement').
--   • `version`     — the document version accepted. When a policy is
--                     republished with a bumped version, the user has
--                     no row at the new version, so the consent gate
--                     forces them to re-accept.
--   • `ip_address`  — captured from the request (x-forwarded-for on
--                     Vercel). text, not inet, so a malformed/missing
--                     proxy header can never break a consent write.
--   • `user_agent`  — raw UA string for device identification.
--   • `context`     — where the acceptance happened: 'signup',
--                     'reacceptance', 'driver-onboarding', etc. Purely
--                     for the audit trail.
--
-- Append-only by design: rows are NEVER updated or deleted by the app.
-- A user accepting v1.0 then later v1.1 leaves BOTH rows — the full
-- history stands. The anonymize-on-account-deletion function
-- deliberately does NOT touch this table: consent records are exactly
-- what must survive a deletion for RAJLO's legal protection.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_key text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  context text not null default 'signup'
);

-- Fast "what has this user accepted" lookup — the consent gate runs
-- this on every portal entry.
create index if not exists legal_acceptances_user_id_idx
  on legal_acceptances(user_id);

-- One acceptance row per (user, document, version). A double-submit or
-- a retry can't create duplicate consent rows; the API upserts with
-- ON CONFLICT DO NOTHING against this index.
create unique index if not exists legal_acceptances_user_doc_version_unique
  on legal_acceptances(user_id, doc_key, version);

-- RLS — a user may read and insert their OWN consent rows. There is no
-- update or delete policy: consent records are immutable. Admin tooling
-- reads via the service-role key, which bypasses RLS.
alter table legal_acceptances enable row level security;

drop policy if exists legal_acceptances_self_select on legal_acceptances;
create policy legal_acceptances_self_select on legal_acceptances
  for select using (auth.uid() = user_id);

drop policy if exists legal_acceptances_self_insert on legal_acceptances;
create policy legal_acceptances_self_insert on legal_acceptances
  for insert with check (auth.uid() = user_id);
