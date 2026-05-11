-- ============================================================================
-- Safety Officer role + alert messaging
-- ----------------------------------------------------------------------------
-- Phase 3 + 4 of the safety system.
--
--   Phase 3 — `safety_officer` is a new role alongside rider / driver /
--             admin. Officers can see the full safety queue, every active
--             trip with live positions, and chat with riders about
--             open alerts. They CANNOT manage wallets, drivers, or any
--             other admin surface — strictly safety scope.
--
--   Phase 4 — `safety_alert_messages` carries the chat between a rider
--             and an officer (or admin) about a specific alert. One
--             row per message. Realtime broadcast handled at the app
--             layer using Supabase's standard Realtime on this table.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ─── 1. Extend the profiles.role check constraint ───
-- Profiles already has a check constraint allowing `rider | driver |
-- admin`. We replace it to add `safety_officer`. The constraint name
-- is the default Postgres auto-assigns when the column is defined
-- inline, which varies by Supabase version — find it dynamically.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('rider', 'driver', 'admin', 'safety_officer'));
END $$;

-- ─── 2. Chat messages on safety alerts ───
CREATE TABLE IF NOT EXISTS public.safety_alert_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.safety_alerts(id) ON DELETE CASCADE,
  -- Author is keyed to auth.users so officers and riders both work.
  -- We DON'T set ON DELETE CASCADE here — if a user is deleted we
  -- want the message history to survive (audit), with the sender
  -- showing as "[Deleted user]" at render time.
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  -- "role" denormalised at write-time so the UI can render the
  -- correct avatar / styling without an extra join on every message.
  -- Restricted set so a tampered client can't claim to be an officer.
  author_role text NOT NULL CHECK (author_role IN ('rider', 'safety_officer', 'admin')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  -- Marker that this message was sent as a pre-canned safety tip
  -- (vs a free-typed message). Useful for analytics + for the rider
  -- UI to render tips with a distinct visual treatment.
  is_tip boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_alert_messages_alert
  ON public.safety_alert_messages (alert_id, created_at ASC);

-- ─── 3. RLS — riders see their own alert threads; officers + admins
--           see everything ───
ALTER TABLE public.safety_alert_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "safety_alert_messages_select_own" ON public.safety_alert_messages;
CREATE POLICY "safety_alert_messages_select_own"
  ON public.safety_alert_messages
  FOR SELECT
  USING (
    -- Rider sees messages on their own alerts
    EXISTS (
      SELECT 1 FROM public.safety_alerts a
      WHERE a.id = safety_alert_messages.alert_id
        AND a.rider_id = auth.uid()
    )
    -- OR the viewer is an officer / admin
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'safety_officer')
    )
  );

DROP POLICY IF EXISTS "safety_alert_messages_insert_own" ON public.safety_alert_messages;
CREATE POLICY "safety_alert_messages_insert_own"
  ON public.safety_alert_messages
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      -- Riders can post on their own alerts
      (author_role = 'rider' AND EXISTS (
        SELECT 1 FROM public.safety_alerts a
        WHERE a.id = safety_alert_messages.alert_id
          AND a.rider_id = auth.uid()
      ))
      -- Officers / admins post on any alert
      OR (author_role IN ('safety_officer', 'admin') AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = author_role
      ))
    )
  );

-- ─── 4. Useful indexes on safety_alerts for officer dashboards ───
-- The list endpoint filters by status + kind ordering by created_at
-- desc; an explicit composite index keeps the safety queue fast even
-- with thousands of historical alerts.
CREATE INDEX IF NOT EXISTS idx_safety_alerts_open_recent
  ON public.safety_alerts (created_at DESC)
  WHERE status = 'open';

COMMENT ON TABLE public.safety_alert_messages IS
  'Chat thread between rider and safety officer / admin about a specific safety_alerts row. Officers send free messages + pre-canned tips; riders reply. Cascades on alert deletion; survives user deletion (audit).';
