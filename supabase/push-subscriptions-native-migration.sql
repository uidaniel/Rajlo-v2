-- ============================================================================
-- Native push tokens in push_subscriptions
-- ----------------------------------------------------------------------------
-- The table was built for browser Web Push (VAPID + p256dh/auth keys).
-- The driver Capacitor app uses Firebase Cloud Messaging (FCM) instead,
-- which has a single opaque token and no key material on the client.
--
-- Two columns added, two relaxed:
--   - `platform` — 'web' (default) | 'android' | 'ios'. Tells the fan-out
--     code which mechanism to use to deliver.
--   - `native_token` — FCM/APNs token. Nullable for backward compat.
--   - `p256dh` and `auth` made nullable — only web-push needs them.
--
-- Idempotent — safe to re-run.
-- ============================================================================

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'android', 'ios')),
  ADD COLUMN IF NOT EXISTS native_token text;

-- The original CHECK / NOT NULL on p256dh and auth has to go — native
-- rows don't carry those keys. Drop NOT NULL if present (idempotent).
ALTER TABLE public.push_subscriptions
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

-- Helpful for the fan-out's "send only to web rows" filter.
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_platform
  ON public.push_subscriptions (user_id, platform);

COMMENT ON COLUMN public.push_subscriptions.platform IS
  'Where this subscription is delivered. `web` uses VAPID + webpush; `android`/`ios` use FCM/APNs via the native_token field.';
