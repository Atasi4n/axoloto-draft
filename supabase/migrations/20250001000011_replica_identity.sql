-- =============================================================
-- Migration 0011: Replica identity for realtime
-- Once a table is in the realtime publication and publishes UPDATEs, Postgres
-- needs a REPLICA IDENTITY to identify the changed row. `auction_state` has no
-- primary key (one row per event) so UPDATEs failed entirely. `participants` is
-- UPDATE-subscribed with an `event_id` filter, which requires that column to be
-- in the replica identity — so both get REPLICA IDENTITY FULL.
-- =============================================================

ALTER TABLE auction_state REPLICA IDENTITY FULL;
ALTER TABLE participants  REPLICA IDENTITY FULL;
