-- =============================================================
-- Migration 0001: Enums
-- Must run before all other migrations (tables depend on these)
-- =============================================================

CREATE TYPE user_role AS ENUM (
  'HOST',
  'PARTICIPANT',
  'COACH'
);

CREATE TYPE event_status AS ENUM (
  'DRAFT',    -- created, not yet visible to participants
  'ACTIVE',   -- visible on landing screen, joinable
  'ARCHIVED'  -- event over, read-only
);

CREATE TYPE auction_phase AS ENUM (
  'WAITING',  -- event created, waiting room open, host hasn't started yet
  'MEGA',     -- mega round: only mega-capable pokemon nominatable
  'MAIN',     -- normal turn-based draft
  'SPECIAL',  -- training session auction (after all teams have 6 pokemon)
  'ENDED'     -- auction complete
);

CREATE TYPE auction_status AS ENUM (
  'IDLE',        -- between nominations (waiting for current participant to nominate)
  'NOMINATING',  -- participant is searching/selecting a pokemon
  'BIDDING',     -- auction active, timer running
  'RESOLVING'    -- timer expired, server assigning winner
);

CREATE TYPE nomination_type AS ENUM (
  'PARTICIPANT',     -- participant nominated on their own turn
  'COACH_OVERRIDE',  -- coach used one of their 2 overrides
  'HOST'             -- host nominated (tiered rounds or manual)
);

CREATE TYPE auction_item_status AS ENUM (
  'ACTIVE',    -- currently being bid on
  'SOLD',      -- won by a participant
  'CANCELLED'  -- host cancelled (undo last action)
);

CREATE TYPE special_item_status AS ENUM (
  'PENDING',  -- seeded, not yet up for auction
  'ACTIVE',   -- currently being bid on
  'SOLD',     -- won by a participant with a bid > 0
  'FREE'      -- no bids, session goes free ($0)
);

CREATE TYPE connection_status AS ENUM (
  'OFFLINE',  -- not connected / hasn't joined yet
  'WAITING',  -- in waiting room, not yet confirmed ready
  'READY'     -- confirmed ready to start
);
