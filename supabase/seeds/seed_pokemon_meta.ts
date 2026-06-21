/**
 * seed_pokemon_meta.ts
 *
 * Populates TWO reference tables from the PokéAPI Champions pokédex:
 *
 *   - pokemon_meta  — one row per species (the default form). Carries the
 *     name, types, sprites, base stats and the derived is_mega_capable flag.
 *   - pokemon_forms — one row per battle-relevant form of each species: the
 *     base form, megas, regional forms, and ability/battle-mechanic forms
 *     (Aegislash, Palafin, Rotom, …). Gigantamax and purely cosmetic
 *     variants are excluded (see EXCLUDED_FORM_PATTERNS).
 *
 * Run once (ever). Safe to re-run — clears both tables first, then reseeds.
 *
 * Optimization vs. the original: a single pass per species. Each variety's
 * /pokemon and /pokemon-form endpoints are fetched exactly once, and
 * is_mega_capable falls out of the same data instead of a second walk over
 * every variety/form.
 *
 * Usage:
 *   npx ts-node --project tsconfig.seed.json supabase/seeds/seed_pokemon_meta.ts
 *
 * Prerequisites:
 *   - Migrations applied (pokemon_meta + pokemon_forms tables exist)
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Takes a few minutes due to PokéAPI rate limiting. Progress logged to stdout.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const POKEAPI_BASE = 'https://pokeapi.co/api/v2'

// PokéAPI rate-limits anonymous clients. A short delay between requests keeps
// us comfortably under the threshold.
const REQUEST_DELAY_MS = 100

// Forms whose slug contains any of these are NOT battle-relevant for the
// Champions format and are skipped. Megas / regionals / battle-mechanic forms
// (Aegislash, Palafin, Rotom, …) are intentionally NOT here — they are kept.
const EXCLUDED_FORM_PATTERNS = [
  'gmax',       // Gigantamax
  'gigantamax',
  'eternamax',  // Eternatus-Eternamax
  'totem',      // Totem (SM/USUM) forms
  'cosplay',    // Cosplay Pikachu
  '-cap',       // Pikachu cap variants (original-cap, world-cap, …)
  'starter',    // Let's Go partner Pikachu/Eevee
]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json()
}

function getStat(stats: any[], name: string): number | null {
  return stats.find((s: any) => s.stat.name === name)?.base_stat ?? null
}

function isExcludedForm(name: string): boolean {
  return EXCLUDED_FORM_PATTERNS.some(p => name.includes(p))
}

/**
 * Fetch the list of species IDs available in the Champions format.
 * entry_number in the champions pokédex is the national dex number (= species_id).
 */
async function fetchChampionsSpeciesIds(): Promise<number[]> {
  const data = await fetchJson(`${POKEAPI_BASE}/pokedex/champions`)
  return data.pokemon_entries.map((e: any) => e.entry_number as number)
}

/** Shape of a single column-aligned pokemon_forms row. */
interface FormRow {
  form_id: number
  species_id: number
  name: string
  form_label: string | null
  is_default: boolean
  is_mega: boolean
  is_battle_only: boolean
  types: string[]
  sprite_front: string | null
  sprite_home: string | null
  sprite_showdown: string | null
  hp: number | null
  attack: number | null
  defense: number | null
  special_attack: number | null
  special_defense: number | null
  speed: number | null
}

/**
 * Build a pokemon_forms row from a variety's /pokemon payload plus the
 * aggregated metadata from its /pokemon-form payload(s).
 * Stats, types and sprites come from /pokemon (the canonical battle data);
 * is_mega / is_battle_only / form label come from /pokemon-form.
 */
function buildFormRow(
  speciesId: number,
  pokemonData: any,
  formMeta: { isMega: boolean; isBattleOnly: boolean; label: string | null }
): FormRow {
  const sprites = pokemonData.sprites ?? {}
  const stats = pokemonData.stats ?? []
  return {
    form_id:         pokemonData.id,
    species_id:      speciesId,
    name:            pokemonData.name,
    form_label:      formMeta.label,
    is_default:      pokemonData.is_default === true,
    is_mega:         formMeta.isMega,
    is_battle_only:  formMeta.isBattleOnly,
    types:           pokemonData.types.map((t: any) => t.type.name as string),
    sprite_front:    sprites.front_default ?? null,
    sprite_home:     sprites.other?.home?.front_default ?? null,
    sprite_showdown: sprites.other?.showdown?.front_default ?? null,
    hp:              getStat(stats, 'hp'),
    attack:          getStat(stats, 'attack'),
    defense:         getStat(stats, 'defense'),
    special_attack:  getStat(stats, 'special-attack'),
    special_defense: getStat(stats, 'special-defense'),
    speed:           getStat(stats, 'speed'),
  }
}

/**
 * Aggregate the /pokemon-form payloads for one variety. A variety almost
 * always has exactly one form; if it has several we OR the boolean flags and
 * take the first non-empty form_name as the label.
 */
async function fetchFormMeta(
  pokemonData: any
): Promise<{ isMega: boolean; isBattleOnly: boolean; label: string | null }> {
  const forms: Array<{ url: string }> = pokemonData.forms ?? []
  let isMega = false
  let isBattleOnly = false
  let label: string | null = null

  for (const form of forms) {
    await sleep(REQUEST_DELAY_MS)
    let formData: any
    try {
      formData = await fetchJson(form.url)
    } catch {
      continue
    }
    if (formData.is_mega === true) isMega = true
    if (formData.is_battle_only === true) isBattleOnly = true
    if (!label && formData.form_name) label = formData.form_name
  }

  return { isMega, isBattleOnly, label }
}

async function main() {
  console.log('Fetching Champions pokédex...')
  const speciesIds = await fetchChampionsSpeciesIds()
  console.log(`Found ${speciesIds.length} species in Champions format.`)
  console.log(`Request delay: ${REQUEST_DELAY_MS}ms (PokéAPI rate limit)\n`)

  // Clear forms first (FK child), then meta (parent).
  console.log('Clearing pokemon_forms and pokemon_meta...')
  const { error: delFormsErr } = await supabase.from('pokemon_forms').delete().gte('form_id', 0)
  if (delFormsErr) {
    console.error('Failed to clear pokemon_forms:', delFormsErr.message)
    process.exit(1)
  }
  const { error: delMetaErr } = await supabase.from('pokemon_meta').delete().gte('species_id', 0)
  if (delMetaErr) {
    console.error('Failed to clear pokemon_meta:', delMetaErr.message)
    process.exit(1)
  }
  console.log('Tables cleared.\n')

  let seeded = 0
  let skipped = 0
  let errors = 0
  let formsSeeded = 0

  for (const speciesId of speciesIds) {
    try {
      await sleep(REQUEST_DELAY_MS)
      const speciesData = await fetchJson(`${POKEAPI_BASE}/pokemon-species/${speciesId}/`)

      const englishName =
        speciesData.names.find((n: any) => n.language.name === 'en')?.name ??
        speciesData.name

      const varieties: Array<{ is_default: boolean; pokemon: { name: string; url: string } }> =
        speciesData.varieties

      const defaultVariety = varieties.find(v => v.is_default)
      if (!defaultVariety) {
        console.warn(`  [SKIP] ${speciesId}: no default variety`)
        skipped++
        continue
      }

      // Single pass over every kept variety: fetch its /pokemon + /pokemon-form
      // once, building the form row and accumulating the species-level mega flag.
      const formRows: FormRow[] = []
      let defaultPokemon: any = null
      let megaCapable = false

      for (const variety of varieties) {
        if (isExcludedForm(variety.pokemon.name)) continue

        await sleep(REQUEST_DELAY_MS)
        let pokemonData: any
        try {
          pokemonData = await fetchJson(variety.pokemon.url)
        } catch {
          continue
        }

        if (variety.is_default) defaultPokemon = pokemonData

        const formMeta = await fetchFormMeta(pokemonData)
        if (formMeta.isMega) megaCapable = true

        formRows.push(buildFormRow(speciesId, pokemonData, formMeta))
      }

      if (!defaultPokemon) {
        console.warn(`  [SKIP] ${speciesId}: default variety could not be fetched`)
        skipped++
        continue
      }

      // --- pokemon_meta (default form) ---
      const sprites = defaultPokemon.sprites ?? {}
      const stats = defaultPokemon.stats ?? []
      const { error: metaError } = await supabase
        .from('pokemon_meta')
        .upsert(
          {
            species_id:      speciesId,
            name:            englishName,
            is_mega_capable: megaCapable,
            sprite_front:    sprites.front_default ?? null,
            sprite_home:     sprites.other?.home?.front_default ?? null,
            sprite_showdown: sprites.other?.showdown?.front_default ?? null,
            types:           defaultPokemon.types.map((t: any) => t.type.name as string),
            hp:              getStat(stats, 'hp'),
            attack:          getStat(stats, 'attack'),
            defense:         getStat(stats, 'defense'),
            special_attack:  getStat(stats, 'special-attack'),
            special_defense: getStat(stats, 'special-defense'),
            speed:           getStat(stats, 'speed'),
          },
          { onConflict: 'species_id' }
        )

      if (metaError) {
        console.error(`  [ERR]  ${speciesId} (${englishName}): ${metaError.message}`)
        errors++
        continue
      }

      // --- pokemon_forms (every kept variety) ---
      // Must follow the meta upsert: form rows FK to pokemon_meta.species_id.
      const { error: formsError } = await supabase.from('pokemon_forms').insert(formRows)
      if (formsError) {
        console.error(`  [ERR]  ${speciesId} (${englishName}) forms: ${formsError.message}`)
        errors++
        continue
      }
      formsSeeded += formRows.length

      const megaFlag = megaCapable ? ' [MEGA]' : ''
      const formCount = formRows.length > 1 ? ` (+${formRows.length - 1} forms)` : ''
      console.log(`  [OK]   ${String(speciesId).padStart(4, ' ')} ${englishName}${megaFlag}${formCount}`)
      seeded++

    } catch (err: any) {
      console.error(`  [ERR]  ${speciesId}: ${err.message}`)
      errors++
    }
  }

  console.log(`\nDone.`)
  console.log(`  Species seeded: ${seeded}`)
  console.log(`  Forms seeded:   ${formsSeeded}`)
  console.log(`  Skipped:        ${skipped}`)
  console.log(`  Errors:         ${errors}`)

  if (errors > 0) {
    console.log('\nSome species failed. Re-run to retry — the seed clears and rebuilds both tables.')
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
