-- ============================================================================
-- Rajlo Phase 2A.2 — enable Realtime broadcasts on the ride tables.
--
-- Adding `rides` and `ride_events` to Supabase's `supabase_realtime`
-- publication makes every INSERT/UPDATE/DELETE on those tables fire to
-- subscribed Postgres-changes channels. The frontend can then drop its
-- 5–7 second polling loops in favour of instant pushes.
--
-- RLS is still enforced — clients only receive events for rows they would
-- have been able to SELECT under their normal policies, so a driver can't
-- snoop on rides assigned to other drivers, etc.
--
-- Idempotent: each ALTER ... ADD TABLE is wrapped in a DO block that
-- swallows the "already member" error if you re-run.
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.rides;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ride_events;
exception when duplicate_object then null;
end $$;
