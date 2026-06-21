# `apps/team` — Pokémon Swiper Requirements

> Status: **Planned / not built.** This document is the product + technical spec for the
> swiper app. It is the contract for what gets built, written against the real shared
> data model (`pokemon_meta`, `pokemon_forms`) and the monorepo's architectural rules.

## 1. Purpose

A Tinder-style Pokémon swiper. The primary user is a single **trainee** who swipes
through Pokémon to record which ones she **likes**, **passes** on, or **superlikes**
(loves). The result is a wishlist she can **share back to the trainer** (the repo owner).

It is a fun, lightweight preference-capture tool — not part of the live auction. Its only
job is: *show Pokémon → capture a verdict → let her share the verdict list.*

## 2. Hard constraints (inherited from the monorepo)

These come from `CLAUDE.md` / `AGENTS.md` and **must not be broken**:

1. **No database writes.** The app uses the anon key and is **read-only** against Supabase.
   All of the trainee's choices live **client-side** (localStorage). Nothing she does
   touches the DB.
2. **No auth, no public signup.** No login screen. Anyone with the URL can use it.
3. **Anon browser client only.** Use `createBrowserSupabaseClient()` from
   `@axoloto/supabase`. Never import service-role/server clients; none exist in this app.
4. **Fully client-side after initial fetch.** One read of the Pokémon reference data on
   load, then everything runs in the browser.
5. **Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui** — same stack as `apps/draft`.
   Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code; this
   Next version has breaking changes vs. training data.
6. **Feature-based structure** under `src/features/`, not global `components/`/`services/`.
7. Deploys as its own Vercel project (Root Directory = `apps/team`), domain `team.axoloto.app`.
   Needs only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 3. Data source

Read-only from the shared Postgres DB via the anon client. Two tables matter:

- **`pokemon_meta`** — one row per evolutionary line, keyed by `species_id` (national dex).
  Fields used: `species_id`, `name`, `is_mega_capable`, `types[]`, sprites
  (`sprite_home`, `sprite_front`, `sprite_showdown`), stats (`hp`, `attack`, `defense`,
  `special_attack`, `special_defense`, `speed`).
- **`pokemon_forms`** — one row per **battle-relevant form**, keyed by `form_id`
  (PokéAPI pokemon.id), FK `species_id → pokemon_meta`. Fields used: `form_id`, `species_id`,
  `name`, `form_label`, `is_default`, `is_mega`, `is_battle_only`, `types[]`, sprites, stats.

**Scope:** **all Pokémon** in the dataset are included (this swiper is general, not tied to
the auction — the auction's banned-species list does **not** apply here).

**Sprite fallback chain** (per form/species): `sprite_home` → `sprite_front` →
`sprite_showdown` → placeholder. Stats and types always come from the **currently displayed
form**, falling back to `pokemon_meta` when a form lacks them.

## 4. Two modes

The app has **two independent swipers**, selectable from a mode switcher on the home screen.
Each maintains its **own deck, progress, and saved verdicts** (they do not share state).

### 4.1 Normal mode

- **Deck:** one card per species (every `species_id`).
- **Card content:** shows **all non-mega forms** of that species (`pokemon_forms` where
  `is_mega = false`), with on-card buttons to **switch between forms**. This includes the
  base/default form plus regional forms (Alolan/Galarian/Hisuian/Paldean) and other
  non-mega battle forms. The **default form** (`is_default = true`) is shown first.
- Species with no extra forms simply show a single form with no switcher.

### 4.2 Mega mode

- **Deck:** only species that can Mega Evolve (`pokemon_meta.is_mega_capable = true`).
- **Card content:** shows the **base form + its mega form(s)**, with buttons to switch
  between them. Base (`is_default`) shown first. Species with multiple megas
  (e.g. Charizard X/Y, Mewtwo X/Y) expose all of them in the switcher.

### 4.3 Card anatomy (both modes)

A card displays, for the **currently selected form**:
- Large sprite (with fallback chain), Pokémon name, and form label when not the default.
- Type badge(s) from the form's `types[]`.
- Base stats (HP / Atk / Def / SpA / SpD / Spe) — display only.
- A **form switcher** (segmented buttons / chips) when the card has more than one form.

Switching forms is **viewing only** — it changes what's shown; it does **not** count as a
swipe. The verdict (§5) applies to the **card** (the species, within that mode). The form
that was on screen at the moment of the verdict is recorded as her **preferred form** for
that card (a useful signal — e.g. which mega she favours), but does not change the verdict
target.

## 5. Interactions (verdicts)

Each card gets exactly one of three verdicts:

| Verdict | Gesture | Button | Meaning |
|---|---|---|---|
| **Pass** | swipe left | ✕ | Not interested |
| **Like** | swipe right | ♥ | Likes it |
| **Superlike** | swipe up | ★ | Loves it (top pick) |

Requirements:
- Both **touch/drag gestures** and **tap buttons** must work (mobile-first; also usable on
  desktop with mouse/keyboard).
- Card animates out in the swipe direction; the next card advances.
- **Undo** (one step): an undo button restores the last swiped card and its prior verdict so
  an accidental swipe can be corrected.
- Keyboard support on desktop: ←/→/↑ for pass/like/superlike, and an undo key.
- A verdict can be **changed later** from the results screen (§7).

## 6. Persistence (client-side only)

All state persists in **localStorage** so a session survives reloads and she can stop and
resume. No DB, no cookies-for-server.

- Keyed per mode, e.g. `axoloto.team.normal.v1` and `axoloto.team.mega.v1`.
- Stored per card: `species_id`, `verdict` (`pass | like | superlike`), `preferredFormId`,
  `decidedAt`.
- Also store deck position / which cards remain so progress resumes where she left off.
- Include a **schema version** in the key/payload for safe future migrations.
- The Pokémon reference data itself may be cached client-side too (it's static), but the DB
  remains the source of truth on each fresh load.
- Provide a **Reset** action (per mode) that clears saved verdicts after a confirm.

## 7. Results / review screen

Per mode, a screen that lets her (and the trainer) review choices:
- Lists her **Superlikes** and **Likes** (Passes available but de-emphasised/collapsible).
- Each entry shows the sprite, name, and her preferred form.
- Allow **changing a verdict** or **removing** an entry (writes back to localStorage).
- Shows progress: decided vs. remaining in the deck.

## 8. Sharing / export (how the list reaches the trainer)

Since nothing is written to the DB, sharing is the bridge. Required:

1. **Share / copy a readable summary** — a text list of her Likes and Superlikes (names +
   preferred form, grouped by verdict and mode), via the native share sheet on mobile
   (`navigator.share`) with a copy-to-clipboard fallback.

Should-have (nice, optional):

2. **Shareable link** — encode her verdicts compactly into a URL (e.g. a bitset / compact
   id list, base64-encoded in the query string or hash) so the trainer can open it and see
   the full wishlist rendered. A read-only **"view a shared list"** route decodes the link
   and displays the cards. Keep payloads small (favour a bitset over per-id JSON) and the
   route fully client-side.

The trainee is never required to create an account or write to any backend to share.

## 9. App structure & routing

Follow the repo's feature-based convention. Indicative layout:

```
apps/team/src/
  app/
    page.tsx              ← home: choose Normal vs Mega, resume/reset
    swipe/                ← the swiper (mode via route/searchParam)
    results/              ← review + share per mode
    shared/               ← (optional) decode + view a shared link
  features/
    swiper/               ← deck, card, gestures, verdict logic, animations
    pokemon/              ← data fetch, form grouping (normal vs mega), sprite fallback
    wishlist/             ← localStorage persistence, results, export/share encoding
  lib/
    supabase/             ← thin re-export of the anon browser client
```

State management may use Zustand (as in `apps/draft`) or React state + a localStorage hook —
implementer's choice, but persistence and resume are required.

## 10. UX / non-functional requirements

- **Mobile-first**, touch-friendly, one-handed; works in portrait. Responsive up to desktop.
- Fast first load: fetch reference data once, show a loading state, then run offline-capable.
- Graceful handling of missing sprites/forms (fallback chain, never a broken image).
- Accessible: buttons have labels; gestures have button equivalents; keyboard support on desktop.
- No flicker between cards; smooth swipe animations.
- Resilient to PokéAPI being irrelevant at runtime — all imagery comes from stored sprite
  URLs in the DB, not live PokéAPI calls.

## 11. Out of scope (for now)

- Auth / multiple user accounts / per-user server profiles.
- Any DB write, including saving wishlists server-side.
- Integration with the live auction/draft (no nominating, bidding, or event coupling).
- Filtering/search by type or generation, sorting decks (could be future enhancements).
- Multi-trainee comparison dashboards.

## 12. Open questions / defaults chosen

- **Deck order:** default to national-dex order; randomised/shuffle order is a possible
  toggle but not required.
- **Verdict granularity:** verdict is per **card (species, per mode)**; preferred form is
  captured as metadata. If per-form verdicts are ever wanted, that's a future change.
- **Battle-only non-mega forms in Normal mode:** included (treated as "non-mega forms").
  Revisit if the deck feels cluttered.
