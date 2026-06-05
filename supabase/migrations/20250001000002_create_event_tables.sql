-- =============================================================
-- Migration 0003: Event-scoped tables
-- All tables here carry event_id FK → events.id.
-- Order matters: tables referenced by FKs must come first.
-- =============================================================


-- -----------------------------------------------------------------
-- participants
-- One row per participant per event. Linked to a users row (auth).
-- budget starts at INITIAL_BUDGET from config, decremented on wins.
-- has_mega: set true when any team_pokemon row for this participant
--   has is_mega_capable = true. Used to gate mega phase end.
-- connection_status: updated in real time during waiting room.
-- -----------------------------------------------------------------
CREATE TABLE participants (
  id                  uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid             NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id             uuid             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name        text             NOT NULL,
  team_name           text,
  budget              int              NOT NULL DEFAULT 1000,
  has_mega            bool             NOT NULL DEFAULT false,
  special_session_won bool             NOT NULL DEFAULT false,
  connection_status   connection_status NOT NULL DEFAULT 'OFFLINE',
  UNIQUE(event_id, user_id),
  CHECK(budget >= 0)
);


-- -----------------------------------------------------------------
-- coaches
-- One row per coach per event. Linked to a users row (auth).
-- -----------------------------------------------------------------
CREATE TABLE coaches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  UNIQUE(event_id, user_id)
);


-- -----------------------------------------------------------------
-- coach_participants
-- Join table linking coaches to their participants within an event.
-- In practice 1-to-1 for this event, but schema supports 1-to-many.
-- overrides_remaining tracks how many coach nomination overrides are left.
-- Starts at COACH_OVERRIDES (2) from config. Decremented on each use.
-- -----------------------------------------------------------------
CREATE TABLE coach_participants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  coach_id            uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  participant_id      uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  overrides_remaining int  NOT NULL DEFAULT 2,
  UNIQUE(event_id, coach_id, participant_id),
  CHECK(overrides_remaining >= 0)
);


-- -----------------------------------------------------------------
-- auction_turns
-- Stores the randomized turn order for participants in an event.
-- Written once by startEvent(). Never mutated after that.
-- position is 0-indexed. current_turn_id in auction_state points
-- to the turn whose participant should nominate next.
-- -----------------------------------------------------------------
CREATE TABLE auction_turns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  position       int  NOT NULL,
  UNIQUE(event_id, participant_id),
  UNIQUE(event_id, position)
);


-- -----------------------------------------------------------------
-- auction_state
-- Exactly ONE row per event. Mutated in place throughout the event.
-- Supabase Realtime clients subscribe to this table for live updates.
-- Created at the same time as the events row (phase = WAITING).
-- -----------------------------------------------------------------
CREATE TABLE auction_state (
  event_id                    uuid           NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  phase                       auction_phase  NOT NULL DEFAULT 'WAITING',
  status                      auction_status NOT NULL DEFAULT 'IDLE',
  current_turn_id             uuid           REFERENCES auction_turns(id),
  current_auction_pokemon_id  uuid,          -- FK added below after auction_pokemon is created
  timer_ends_at               timestamptz,
  host_override_active        bool           NOT NULL DEFAULT false
);


-- -----------------------------------------------------------------
-- auction_pokemon
-- One row per pokemon nominated during the auction.
-- Name and sprite are snapshotted at nomination time so the auction
-- remains stable even if PokéAPI changes or goes down.
-- species_id is the national dex number (NOT a FK to pokemon_meta —
-- intentionally a snapshot).
-- -----------------------------------------------------------------
CREATE TABLE auction_pokemon (
  id                          uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                    uuid                 NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  species_id                  int                  NOT NULL,
  name_snapshot               text                 NOT NULL,
  sprite_snapshot             text,
  is_mega_capable             bool                 NOT NULL DEFAULT false,
  nominated_by                nomination_type      NOT NULL,
  nominated_by_participant_id uuid                 REFERENCES participants(id),
  status                      auction_item_status  NOT NULL DEFAULT 'ACTIVE',
  sold_to                     uuid                 REFERENCES participants(id),
  sold_price                  int,
  nominated_at                timestamptz          NOT NULL DEFAULT now()
);

-- Now that auction_pokemon exists, add the deferred FK on auction_state
ALTER TABLE auction_state
  ADD CONSTRAINT fk_auction_state_current_pokemon
  FOREIGN KEY (current_auction_pokemon_id)
  REFERENCES auction_pokemon(id);


-- -----------------------------------------------------------------
-- bids
-- Append-only. One row per bid placed. Never updated, never deleted.
-- amount constraints mirror config values (MIN_BID=50, MAX_BID=750).
-- placed_at is set server-side (DB default), never trusted from client.
-- -----------------------------------------------------------------
CREATE TABLE bids (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  auction_pokemon_id  uuid        NOT NULL REFERENCES auction_pokemon(id) ON DELETE CASCADE,
  participant_id      uuid        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  amount              int         NOT NULL,
  placed_at           timestamptz NOT NULL DEFAULT now(),
  CHECK(amount >= 50 AND amount <= 750)
);


-- -----------------------------------------------------------------
-- team_pokemon
-- One row per pokemon owned by a participant at the end of an auction.
-- Written by assignPokemon() when a bid is won (or auto-assigned at $50).
-- UNIQUE(event_id, participant_id, species_id) enforces the
-- "one form per pokemon line" rule at the DB level.
-- is_mega_capable: did this pokemon satisfy the mega phase requirement?
--   NOT the same as "is currently in mega form" (mega evolving happens
--   in battle, not in the draft).
-- -----------------------------------------------------------------
CREATE TABLE team_pokemon (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id      uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  species_id          int  NOT NULL,
  name_snapshot       text NOT NULL,
  sprite_snapshot     text,
  is_mega_capable     bool NOT NULL DEFAULT false,
  purchase_price      int  NOT NULL,
  auction_pokemon_id  uuid NOT NULL REFERENCES auction_pokemon(id),
  UNIQUE(event_id, participant_id, species_id)
);


-- -----------------------------------------------------------------
-- special_auction_items
-- One row per coach per event, seeded before the event starts.
-- Represents a training session with that coach.
-- won_by: only one participant per item (enforced by application logic,
--   not a DB constraint, because it needs the "one win per participant"
--   check across all items for that participant).
-- final_price: 0 if FREE (no bids), otherwise the winning bid amount.
-- -----------------------------------------------------------------
CREATE TABLE special_auction_items (
  id          uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid                NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  coach_id    uuid                NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  description text,
  status      special_item_status NOT NULL DEFAULT 'PENDING',
  won_by      uuid                REFERENCES participants(id),
  final_price int                 NOT NULL DEFAULT 0
);
