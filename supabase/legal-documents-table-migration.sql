-- ─────────────────────────────────────────────────────────────────────
-- Admin-editable legal documents + OTP-gated edit flow
--
-- Until now, policy TEXT lived in the repo (`policies/*.txt`) and a
-- change meant a code deploy. This migration moves the live content
-- into the database so an admin can publish a policy update from the
-- admin panel — no codebase touch.
--
-- Two tables:
--
--   legal_documents       — the LIVE published copy of each policy.
--                           Empty until a policy is first edited; the
--                           app falls back to the committed
--                           `policies/*.txt` baseline for any key with
--                           no row here. After an admin edits a policy,
--                           its row here becomes authoritative.
--
--   legal_document_edits  — a PENDING edit awaiting OTP confirmation.
--                           When an admin submits an edit, the proposed
--                           content lands here with a hashed OTP. The
--                           admin then enters the OTP mailed to them;
--                           on a match the row is promoted into
--                           legal_documents and deleted. One pending
--                           edit per document (latest submission wins).
--
-- The structural catalog (which keys exist, and each policy's audience)
-- stays in code (src/lib/legal-documents.ts) — that's not something an
-- admin should be able to mutate. Only the editable content lives here.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

-- ── Live published documents ──
create table if not exists legal_documents (
  key text primary key,                 -- matches the code catalog key
  title text not null,
  version text not null,                -- bump to force re-acceptance
  effective_date date not null,
  summary text not null,
  body text not null,                   -- full policy text
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_email text
);

-- Published policies are public information — anyone (signed in or not)
-- may read them, which is what lets the /legal pages and the consent
-- gate read this table with the caller's own client. Writes happen
-- only through the service-role key (admin API), which bypasses RLS,
-- so there is deliberately no insert/update/delete policy.
alter table legal_documents enable row level security;

drop policy if exists legal_documents_public_read on legal_documents;
create policy legal_documents_public_read on legal_documents
  for select using (true);

-- ── Pending OTP-gated edits ──
create table if not exists legal_document_edits (
  doc_key text primary key,              -- one pending edit per document
  title text not null,
  version text not null,
  effective_date date not null,
  summary text not null,
  body text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_by_email text,
  -- The OTP is stored as a SHA-256 hash, never in plaintext. The admin
  -- API compares hash(submitted_otp) against this.
  otp_hash text not null,
  otp_expires_at timestamptz not null,
  -- Wrong-OTP attempt counter — the confirm endpoint refuses after a
  -- small number of failures and the admin must restart the edit.
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

-- Pending edits hold an (admittedly hashed) OTP and unpublished policy
-- text — strictly admin-only. RLS is enabled with NO policies, so the
-- table is reachable only via the service-role key.
alter table legal_document_edits enable row level security;
