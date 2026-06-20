-- =============================================================
-- Migration 0008: Fix RLS infinite recursion
-- The "read same event" policies referenced participants/coaches inside
-- subqueries on those same tables, and auth_user_role() queried `users`
-- whose policy calls auth_user_role() — both cause 42P17 / 54001 recursion,
-- breaking ALL authenticated reads.
--
-- Fix: SECURITY DEFINER helper functions (which bypass RLS) compute the
-- caller's role / event_ids, and every policy references those instead of
-- self-referential subqueries.
-- =============================================================

-- Helpers become SECURITY DEFINER so they don't trigger the very policies
-- that call them.
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_participant_id(p_event_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM participants
  WHERE user_id = auth.uid() AND event_id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION auth_coach_id(p_event_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM coaches
  WHERE user_id = auth.uid() AND event_id = p_event_id;
$$;

-- New helper: the set of event ids the caller belongs to (participant or coach).
-- SECURITY DEFINER bypasses RLS on participants/coaches → no recursion.
CREATE OR REPLACE FUNCTION auth_event_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT event_id FROM participants WHERE user_id = auth.uid()
  UNION
  SELECT event_id FROM coaches WHERE user_id = auth.uid();
$$;

-- ── Rewrite every recursive policy to use the helpers ──────────────────────

DROP POLICY IF EXISTS "participants: read same event" ON participants;
CREATE POLICY "participants: read same event"
  ON participants FOR SELECT
  USING (event_id IN (SELECT auth_event_ids()) OR auth_user_role() = 'HOST');

DROP POLICY IF EXISTS "coaches: read same event" ON coaches;
CREATE POLICY "coaches: read same event"
  ON coaches FOR SELECT
  USING (event_id IN (SELECT auth_event_ids()) OR auth_user_role() = 'HOST');

DROP POLICY IF EXISTS "events: read own event" ON events;
CREATE POLICY "events: read own event"
  ON events FOR SELECT
  USING (id IN (SELECT auth_event_ids()));

DROP POLICY IF EXISTS "coach_participants: read same event" ON coach_participants;
CREATE POLICY "coach_participants: read same event"
  ON coach_participants FOR SELECT
  USING (event_id IN (SELECT auth_event_ids()) OR auth_user_role() = 'HOST');

DROP POLICY IF EXISTS "auction_turns: read same event" ON auction_turns;
CREATE POLICY "auction_turns: read same event"
  ON auction_turns FOR SELECT
  USING (event_id IN (SELECT auth_event_ids()) OR auth_user_role() = 'HOST');

DROP POLICY IF EXISTS "auction_state: read same event" ON auction_state;
CREATE POLICY "auction_state: read same event"
  ON auction_state FOR SELECT
  USING (event_id IN (SELECT auth_event_ids()) OR auth_user_role() = 'HOST');

DROP POLICY IF EXISTS "auction_pokemon: read same event" ON auction_pokemon;
CREATE POLICY "auction_pokemon: read same event"
  ON auction_pokemon FOR SELECT
  USING (event_id IN (SELECT auth_event_ids()) OR auth_user_role() = 'HOST');

DROP POLICY IF EXISTS "bids: read same event" ON bids;
CREATE POLICY "bids: read same event"
  ON bids FOR SELECT
  USING (event_id IN (SELECT auth_event_ids()) OR auth_user_role() = 'HOST');

DROP POLICY IF EXISTS "team_pokemon: read same event" ON team_pokemon;
CREATE POLICY "team_pokemon: read same event"
  ON team_pokemon FOR SELECT
  USING (event_id IN (SELECT auth_event_ids()) OR auth_user_role() = 'HOST');

DROP POLICY IF EXISTS "special_items: read same event" ON special_auction_items;
CREATE POLICY "special_items: read same event"
  ON special_auction_items FOR SELECT
  USING (event_id IN (SELECT auth_event_ids()) OR auth_user_role() = 'HOST');
