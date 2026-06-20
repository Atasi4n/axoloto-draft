-- =============================================================
-- Migration 0010: Enable Realtime
-- The client subscribes (useAuctionRealtime) to postgres_changes on these
-- tables, but Supabase does NOT add tables to the `supabase_realtime`
-- publication automatically — so no change events were ever broadcast and
-- clients (participants/coaches) never saw the host's phase change live.
-- This adds them, idempotently.
-- =============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'auction_state',
    'auction_pokemon',
    'bids',
    'participants',
    'team_pokemon'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
