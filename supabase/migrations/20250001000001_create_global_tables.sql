-- =============================================================
-- Migration 0002: Global tables
-- No event_id FK. These exist across all events.
-- =============================================================


-- -----------------------------------------------------------------
-- users
-- Mirrors auth.users (Supabase Auth). One row per authenticated user.
-- Role is global — a HOST is always a HOST across events.
-- Credentials are created manually before each event (no public signup).
-- -----------------------------------------------------------------
CREATE TABLE users (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username  text NOT NULL UNIQUE,
  role      user_role NOT NULL
);

-- Allow Supabase Auth trigger to fire before RLS is applied.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------
-- pokemon_meta
-- Pre-seeded reference table. Populated once by seed_pokemon_meta.ts.
-- is_mega_capable is derived from PokéAPI pokemon-form endpoint (is_mega flag).
-- Manually editable in Supabase Studio to correct any API errors.
-- Ban list is NOT stored here — it lives in auction.config.ts.
-- -----------------------------------------------------------------
CREATE TABLE pokemon_meta (
  species_id      int  PRIMARY KEY,  -- national dex number (same for all forms)
  name            text NOT NULL,
  is_mega_capable bool NOT NULL DEFAULT false,
  sprite_url      text,              -- front_default from PokéAPI sprites
  types           text[]             -- e.g. ARRAY['fire', 'flying']
);


-- -----------------------------------------------------------------
-- events
-- One row per event. status controls visibility on the landing screen.
-- DRAFT → created but hidden. ACTIVE → visible. ARCHIVED → read-only.
-- config_key maps to a ruleset in auction.config.ts (always 'standard' for now).
-- -----------------------------------------------------------------
CREATE TABLE events (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text         NOT NULL UNIQUE,  -- e.g. 'paralimpico-2025', used in URLs
  display_name text         NOT NULL,
  config_key   text         NOT NULL DEFAULT 'standard',
  status       event_status NOT NULL DEFAULT 'DRAFT',
  created_at   timestamptz  NOT NULL DEFAULT now()
);
