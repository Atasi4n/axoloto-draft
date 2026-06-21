-- =============================================================
-- Migration 0013: pokemon_forms
-- One row per battle-relevant FORM (variety) of a species:
--   - the base form itself (is_default = true)
--   - mega evolutions (is_mega = true, drafted via the base form)
--   - regional forms (alola / galar / hisui / paldea)
--   - ability / battle-mechanic forms (Aegislash blade-shield, Palafin
--     zero-to-hero, Rotom appliances, etc.)
-- Gigantamax and purely cosmetic variants are filtered out by the seed,
-- not stored here.
--
-- PRIMARY KEY = form_id, which is the PokéAPI `pokemon.id`. It is globally
-- unique across every form: default forms equal the national dex number
-- (charizard = 6) and alternate forms live in the 10000+ range
-- (charizard-mega-x = 10034). species_id FKs back to pokemon_meta, so all
-- forms of one line share a single identity — matching the repo-wide
-- convention of keying identity by species_id. (1 species → many forms.)
-- =============================================================

CREATE TABLE pokemon_forms (
  form_id          int  PRIMARY KEY,                          -- PokéAPI pokemon.id
  species_id       int  NOT NULL
                     REFERENCES pokemon_meta(species_id) ON DELETE CASCADE,
  name             text NOT NULL,                             -- full form slug, e.g. 'charizard-mega-x'
  form_label       text,                                      -- differentiator only, e.g. 'mega-x' / 'alola' / 'hero'; NULL for the base form
  is_default       bool NOT NULL DEFAULT false,               -- the base species form
  is_mega          bool NOT NULL DEFAULT false,               -- a mega evolution
  is_battle_only   bool NOT NULL DEFAULT false,               -- form only exists mid-battle (megas, Aegislash-blade, Palafin-hero) — drafted via the base
  types            text[],                                    -- e.g. ARRAY['fire','flying']
  sprite_front     text,                                      -- sprites.front_default
  sprite_home      text,                                      -- sprites.other.home.front_default
  sprite_showdown  text,                                      -- sprites.other.showdown.front_default (animated gif)
  hp               int,
  attack           int,
  defense          int,
  special_attack   int,
  special_defense  int,
  speed            int
);

-- Fastest path for "give me every form of this species" (roster / form switcher).
CREATE INDEX idx_pokemon_forms_species ON pokemon_forms(species_id);

-- -----------------------------------------------------------------
-- Row Level Security — mirrors pokemon_meta: fully public read,
-- writes only via the service role (seed script).
-- -----------------------------------------------------------------
ALTER TABLE pokemon_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pokemon_forms: read all"
  ON pokemon_forms FOR SELECT
  USING (true);
-- No INSERT/UPDATE policy = no write access for anon/authenticated.
