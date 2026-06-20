-- =============================================================
-- Migration 0009: Host write policies
-- The host's server actions (startEvent, skipTurn, cancelAuction,
-- advancePhase, assignPokemon) write via the authenticated server client, but
-- RLS only had SELECT policies on the auction tables → every write was denied
-- ("new row violates row-level security policy"). These policies let an
-- authenticated HOST write the auction tables. (participants already has a
-- "host updates all" policy; the place_bid/resolve_auction RPCs run SECURITY
-- DEFINER and bypass RLS regardless.)
-- =============================================================

CREATE POLICY "auction_state: host writes"
  ON auction_state FOR UPDATE
  USING (auth_user_role() = 'HOST')
  WITH CHECK (auth_user_role() = 'HOST');

CREATE POLICY "auction_turns: host writes"
  ON auction_turns FOR ALL
  USING (auth_user_role() = 'HOST')
  WITH CHECK (auth_user_role() = 'HOST');

CREATE POLICY "auction_pokemon: host writes"
  ON auction_pokemon FOR ALL
  USING (auth_user_role() = 'HOST')
  WITH CHECK (auth_user_role() = 'HOST');

CREATE POLICY "team_pokemon: host writes"
  ON team_pokemon FOR ALL
  USING (auth_user_role() = 'HOST')
  WITH CHECK (auth_user_role() = 'HOST');
