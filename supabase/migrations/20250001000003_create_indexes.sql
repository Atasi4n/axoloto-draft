-- =============================================================
-- Migration 0004: Indexes
-- Run after all tables exist.
-- =============================================================

-- bids: fastest path for "what is the current highest bid?"
-- Used in every placeBid validation and in resolveAuction.
CREATE INDEX idx_bids_pokemon_amount
  ON bids(auction_pokemon_id, amount DESC);

-- bids: fastest path for "when did this participant last bid?"
-- Used in the anti-spam cooldown check in validateBid.
CREATE INDEX idx_bids_participant_time
  ON bids(participant_id, placed_at DESC);

-- auction_pokemon: quick lookup of all active/sold pokemon for an event.
-- Used by the stream view and host panel to display the full pool.
CREATE INDEX idx_auction_pokemon_event_status
  ON auction_pokemon(event_id, status);

-- team_pokemon: all pokemon owned by a participant in an event.
-- Used constantly — roster display, budget protection calc, has_mega check.
CREATE INDEX idx_team_pokemon_participant
  ON team_pokemon(event_id, participant_id);

-- participants: all participants in an event.
-- Used by waiting room, turn order display, budget rankings.
CREATE INDEX idx_participants_event
  ON participants(event_id);

-- coaches: all coaches in an event.
CREATE INDEX idx_coaches_event
  ON coaches(event_id);

-- coach_participants: look up which participants a coach manages.
CREATE INDEX idx_coach_participants_coach
  ON coach_participants(event_id, coach_id);

-- special_auction_items: all items for an event.
CREATE INDEX idx_special_items_event
  ON special_auction_items(event_id);
