-- =============================================================
-- Migration 0005: Row Level Security
-- Enables RLS on all tables and defines access policies.
-- =============================================================

-- Helper: get the role of the currently authenticated user.
-- Used in policy expressions to avoid repeated subqueries.
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE sql STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- Helper: get the participant id for the current user in a given event.
CREATE OR REPLACE FUNCTION auth_participant_id(p_event_id uuid)
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT id FROM participants
  WHERE user_id = auth.uid() AND event_id = p_event_id;
$$;

-- Helper: get the coach id for the current user in a given event.
CREATE OR REPLACE FUNCTION auth_coach_id(p_event_id uuid)
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT id FROM coaches
  WHERE user_id = auth.uid() AND event_id = p_event_id;
$$;


-- =============================================================
-- users
-- =============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read their own row.
CREATE POLICY "users: read own"
  ON users FOR SELECT
  USING (id = auth.uid());

-- HOST can read all users (needed for admin panel).
CREATE POLICY "users: host reads all"
  ON users FOR SELECT
  USING (auth_user_role() = 'HOST');

-- Insert is handled by the seed script via service role key.
-- No INSERT policy needed for anon/authenticated.


-- =============================================================
-- pokemon_meta
-- =============================================================
ALTER TABLE pokemon_meta ENABLE ROW LEVEL SECURITY;

-- Fully public read — every role needs to look up pokemon data.
CREATE POLICY "pokemon_meta: read all"
  ON pokemon_meta FOR SELECT
  USING (true);

-- Only service role (seed script) can write. No policy = no access for anon/auth.


-- =============================================================
-- events
-- =============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Anyone can read ACTIVE events (for the landing screen).
CREATE POLICY "events: read active"
  ON events FOR SELECT
  USING (status = 'ACTIVE');

-- Authenticated users can read any event they are a participant or coach in
-- (so they can see DRAFT events they've been assigned to).
CREATE POLICY "events: read own event"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.event_id = events.id
        AND participants.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.event_id = events.id
        AND coaches.user_id = auth.uid()
    )
  );

-- HOST can read all events.
CREATE POLICY "events: host reads all"
  ON events FOR SELECT
  USING (auth_user_role() = 'HOST');

-- HOST can update events (to change status).
CREATE POLICY "events: host updates"
  ON events FOR UPDATE
  USING (auth_user_role() = 'HOST');


-- =============================================================
-- participants
-- =============================================================
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Participants and coaches in the same event can see each other.
-- (Needed for stream view, roster display, bidding UI.)
CREATE POLICY "participants: read same event"
  ON participants FOR SELECT
  USING (
    event_id IN (
      SELECT p2.event_id FROM participants p2 WHERE p2.user_id = auth.uid()
      UNION
      SELECT c.event_id FROM coaches c WHERE c.user_id = auth.uid()
    )
    OR auth_user_role() = 'HOST'
  );

-- Participants can update their own connection_status.
CREATE POLICY "participants: update own connection status"
  ON participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- HOST can update any participant (budget edits, etc.).
CREATE POLICY "participants: host updates all"
  ON participants FOR UPDATE
  USING (auth_user_role() = 'HOST');


-- =============================================================
-- coaches
-- =============================================================
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches: read same event"
  ON coaches FOR SELECT
  USING (
    event_id IN (
      SELECT p.event_id FROM participants p WHERE p.user_id = auth.uid()
      UNION
      SELECT c2.event_id FROM coaches c2 WHERE c2.user_id = auth.uid()
    )
    OR auth_user_role() = 'HOST'
  );


-- =============================================================
-- coach_participants
-- =============================================================
ALTER TABLE coach_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_participants: read same event"
  ON coach_participants FOR SELECT
  USING (
    event_id IN (
      SELECT p.event_id FROM participants p WHERE p.user_id = auth.uid()
      UNION
      SELECT c.event_id FROM coaches c WHERE c.user_id = auth.uid()
    )
    OR auth_user_role() = 'HOST'
  );


-- =============================================================
-- auction_turns
-- =============================================================
ALTER TABLE auction_turns ENABLE ROW LEVEL SECURITY;

-- All event participants and coaches can read the turn order.
CREATE POLICY "auction_turns: read same event"
  ON auction_turns FOR SELECT
  USING (
    event_id IN (
      SELECT p.event_id FROM participants p WHERE p.user_id = auth.uid()
      UNION
      SELECT c.event_id FROM coaches c WHERE c.user_id = auth.uid()
    )
    OR auth_user_role() = 'HOST'
  );


-- =============================================================
-- auction_state
-- =============================================================
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;

-- All event participants and coaches can read the live state.
-- (This is the table Realtime subscriptions watch.)
CREATE POLICY "auction_state: read same event"
  ON auction_state FOR SELECT
  USING (
    event_id IN (
      SELECT p.event_id FROM participants p WHERE p.user_id = auth.uid()
      UNION
      SELECT c.event_id FROM coaches c WHERE c.user_id = auth.uid()
    )
    OR auth_user_role() = 'HOST'
  );

-- Only server-side RPCs (run with service role) write to auction_state.
-- No client-facing write policies.


-- =============================================================
-- auction_pokemon
-- =============================================================
ALTER TABLE auction_pokemon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auction_pokemon: read same event"
  ON auction_pokemon FOR SELECT
  USING (
    event_id IN (
      SELECT p.event_id FROM participants p WHERE p.user_id = auth.uid()
      UNION
      SELECT c.event_id FROM coaches c WHERE c.user_id = auth.uid()
    )
    OR auth_user_role() = 'HOST'
  );


-- =============================================================
-- bids
-- =============================================================
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Anyone in the event can read all bids (for bid history display).
CREATE POLICY "bids: read same event"
  ON bids FOR SELECT
  USING (
    event_id IN (
      SELECT p.event_id FROM participants p WHERE p.user_id = auth.uid()
      UNION
      SELECT c.event_id FROM coaches c WHERE c.user_id = auth.uid()
    )
    OR auth_user_role() = 'HOST'
  );

-- Participants can insert their own bids.
-- The actual validation (amount, cooldown, budget) happens in the
-- place_bid RPC function which runs with SECURITY DEFINER.
-- This policy is a last-resort safety net only.
CREATE POLICY "bids: participant inserts own"
  ON bids FOR INSERT
  WITH CHECK (
    participant_id = auth_participant_id(event_id)
    AND auth_user_role() = 'PARTICIPANT'
  );


-- =============================================================
-- team_pokemon
-- =============================================================
ALTER TABLE team_pokemon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_pokemon: read same event"
  ON team_pokemon FOR SELECT
  USING (
    event_id IN (
      SELECT p.event_id FROM participants p WHERE p.user_id = auth.uid()
      UNION
      SELECT c.event_id FROM coaches c WHERE c.user_id = auth.uid()
    )
    OR auth_user_role() = 'HOST'
  );

-- Writes are exclusively done by the resolve_auction RPC (service role).


-- =============================================================
-- special_auction_items
-- =============================================================
ALTER TABLE special_auction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "special_items: read same event"
  ON special_auction_items FOR SELECT
  USING (
    event_id IN (
      SELECT p.event_id FROM participants p WHERE p.user_id = auth.uid()
      UNION
      SELECT c.event_id FROM coaches c WHERE c.user_id = auth.uid()
    )
    OR auth_user_role() = 'HOST'
  );
