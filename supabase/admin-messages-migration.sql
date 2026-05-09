-- ============================================================================
-- Rajlo — Admin messaging center
--
-- One row per "broadcast" — i.e. one composer submission. The actual
-- per-recipient delivery results are denormalised into the same row
-- as a JSONB summary (sent / failed / skipped counts), since we don't
-- need to query individual recipient outcomes — we just need to know
-- "what was sent, when, by whom, to which audience, and how it went".
--
-- Audience is captured both as a high-level descriptor (`audience_kind`)
-- and the resolved recipient count, so the audit log can answer both
-- "what did admin X send" AND "how many users got the May 12 promo".
--
-- Schema:
--   id              uuid PK
--   actor_id        admin auth user id (nullable so a deleted admin's
--                                       past sends still resolve)
--   actor_label     denormalised admin name
--   audience_kind   'user' | 'role:rider' | 'role:driver' | 'role:admin'
--                   | 'all' | 'list'
--   audience_size   integer count of resolved recipients
--   audience_meta   jsonb — extra context (e.g. specific user IDs for
--                   'user' / 'list', role + filters for 'role:*')
--   channels        text[] of 'email' | 'push' | 'inbox'
--   subject         text  — required for email; first 80 chars used as
--                           push title for non-email-only sends
--   body            text  — plain-text body; rendered into HTML for email
--   href            text  — optional CTA link the push + inbox row open
--   cta             text  — optional CTA button label
--   results         jsonb — { email: {sent, failed, skipped},
--                             push:  {sent, failed, skipped},
--                             inbox: {sent, failed} }
--   created_at      timestamptz
--
-- RLS: admins can read every row; service_role bypasses for inserts.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),

  actor_id uuid references auth.users(id) on delete set null,
  actor_label text,

  audience_kind text not null
    check (audience_kind in ('user', 'role:rider', 'role:driver', 'role:admin', 'all', 'list')),
  audience_size integer not null default 0,
  audience_meta jsonb,

  channels text[] not null,
  subject text not null,
  body text not null,
  href text,
  cta text,

  results jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_admin_messages_created_at
  on public.admin_messages(created_at desc);

create index if not exists idx_admin_messages_actor
  on public.admin_messages(actor_id, created_at desc);

create index if not exists idx_admin_messages_audience
  on public.admin_messages(audience_kind, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.admin_messages enable row level security;

-- Admins can read every row. service_role bypasses RLS for inserts.
drop policy if exists "Admins read admin_messages" on public.admin_messages;
create policy "Admins read admin_messages"
  on public.admin_messages for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
