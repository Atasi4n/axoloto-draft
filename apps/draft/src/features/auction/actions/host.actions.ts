'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { adminClient }   from '@/lib/supabase/admin'
import { startEvent }    from '@/features/auction/engine/startEvent'
import { resolveAuction } from '@/features/auction/engine/resolveAuction'
import { advanceTurn }   from '@/features/auction/engine/advanceTurn'
import { checkMegaPhase } from '@/features/auction/engine/checkMegaPhase'
import { validateNomination } from '@/features/auction/engine/validateNomination'
import { AUCTION_CONFIG } from '@/lib/config/auction.config'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AuctionPhase } from '@/types/auction.types'

type ActionResult =
  | { success: true }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Shared auth guard — all host actions run this first.
// Returns the authenticated supabase client or an error result.
// ---------------------------------------------------------------------------
async function requireHost(): Promise<
  | { ok: true;  supabase: SupabaseClient<Database> }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRow || userRow.role !== 'HOST') {
    return { ok: false, error: 'Host access required.' }
  }

  return { ok: true, supabase }
}

// ---------------------------------------------------------------------------
// startEvent — randomises turn order, transitions WAITING → MEGA.
// ---------------------------------------------------------------------------
export async function startEventAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const result = await startEvent(eventId)
  if (!result.success) return { success: false, error: result.error }

  return { success: true }
}

// ---------------------------------------------------------------------------
// skipTurn — advances current_turn_id to next position.
// Requires no active auction (cancel first if needed).
// ---------------------------------------------------------------------------
export async function skipTurnAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: state } = await auth.supabase
    .from('auction_state')
    .select('status')
    .eq('event_id', eventId)
    .single()

  if (state?.status === 'BIDDING') {
    return {
      success: false,
      error:   'An auction is in progress. Cancel it before skipping the turn.',
    }
  }

  const result = await advanceTurn(eventId)
  if (!result.success) return { success: false, error: result.error }

  // Clear the nomination timer so the next turn starts fresh.
  await auth.supabase
    .from('auction_state')
    .update({ timer_ends_at: null })
    .eq('event_id', eventId)

  return { success: true }
}

// ---------------------------------------------------------------------------
// startNominationTimer — sets the 2-minute nomination deadline for the current
// turn. Host-driven; only while IDLE (not during bidding). Stored in
// timer_ends_at so every screen (stream/host/mobile) shows the same countdown.
// ---------------------------------------------------------------------------
export async function startNominationTimerAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: state } = await auth.supabase
    .from('auction_state')
    .select('status')
    .eq('event_id', eventId)
    .single()

  if (state?.status === 'BIDDING') {
    return { success: false, error: 'Cannot start the nomination timer during bidding.' }
  }

  const timerEndsAt = new Date(
    Date.now() + AUCTION_CONFIG.NOMINATION_SECONDS * 1000,
  ).toISOString()

  const { error } = await auth.supabase
    .from('auction_state')
    .update({ timer_ends_at: timerEndsAt })
    .eq('event_id', eventId)

  if (error) return { success: false, error: 'Failed to start the nomination timer.' }

  return { success: true }
}

// ---------------------------------------------------------------------------
// cancelAuction — cancels the active auction_pokemon and resets to IDLE.
// Turn does NOT advance — the same participant nominates again.
// ---------------------------------------------------------------------------
export async function cancelAuctionAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: state, error: stateError } = await auth.supabase
    .from('auction_state')
    .select('status, current_auction_pokemon_id')
    .eq('event_id', eventId)
    .single()

  if (stateError || !state) {
    return { success: false, error: 'Auction state not found.' }
  }

  if (state.status !== 'BIDDING') {
    return { success: false, error: 'No active auction to cancel.' }
  }

  if (!state.current_auction_pokemon_id) {
    return { success: false, error: 'No active auction pokemon found.' }
  }

  // Mark the auction_pokemon as CANCELLED
  const { error: cancelError } = await auth.supabase
    .from('auction_pokemon')
    .update({ status: 'CANCELLED' })
    .eq('id', state.current_auction_pokemon_id)

  if (cancelError) {
    return { success: false, error: 'Failed to cancel auction.' }
  }

  // Reset auction_state to IDLE — same turn, no timer, no pause
  const { error: resetError } = await auth.supabase
    .from('auction_state')
    .update({
      status:                     'IDLE',
      current_auction_pokemon_id: null,
      timer_ends_at:              null,
      paused_at:                  null,
    })
    .eq('event_id', eventId)

  if (resetError) {
    return { success: false, error: 'Failed to reset auction state.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// editBudget — directly sets a participant's budget.
// Use for corrections; the host may also use assignPokemon which costs $0.
// ---------------------------------------------------------------------------
export async function editBudgetAction(
  eventId:       string,
  participantId: string,
  newAmount:     number,
): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  if (!Number.isInteger(newAmount) || newAmount < 0) {
    return { success: false, error: 'Budget must be a non-negative integer.' }
  }

  const { error } = await auth.supabase
    .from('participants')
    .update({ budget: newAmount })
    .eq('event_id', eventId)
    .eq('id', participantId)

  if (error) return { success: false, error: 'Failed to update budget.' }

  return { success: true }
}

// ---------------------------------------------------------------------------
// assignPokemon — host manually assigns a pokemon to a participant.
// Creates a HOST auction_pokemon (status=SOLD, price=$0) + team_pokemon row.
// Cancels any currently active auction first, then advances the turn.
// ---------------------------------------------------------------------------
export async function assignPokemonAction(
  eventId:       string,
  speciesId:     number,
  participantId: string,
): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  // Banned species check
  if ((AUCTION_CONFIG.BANNED_SPECIES_IDS as readonly number[]).includes(speciesId)) {
    return { success: false, error: 'This Pokemon is banned from the auction.' }
  }

  // Fetch snapshot data from pokemon_meta
  const { data: pokemon, error: pokemonError } = await auth.supabase
    .from('pokemon_meta')
    .select('name, sprite_front, is_mega_capable')
    .eq('species_id', speciesId)
    .single()

  if (pokemonError || !pokemon) {
    return { success: false, error: 'Pokemon not found in the Champions format.' }
  }

  // Ensure not already on this participant's team
  const { count: teamCount } = await auth.supabase
    .from('team_pokemon')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('participant_id', participantId)
    .eq('species_id', speciesId)

  if (teamCount && teamCount > 0) {
    return { success: false, error: 'This Pokemon is already on this participant\'s team.' }
  }

  // Ensure participant's team has room
  const { count: currentTeamSize } = await auth.supabase
    .from('team_pokemon')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('participant_id', participantId)

  if ((currentTeamSize ?? 0) >= AUCTION_CONFIG.TEAM_SIZE) {
    return { success: false, error: 'This participant\'s team is already full.' }
  }

  // If there is an active auction running, cancel it first
  const { data: state } = await auth.supabase
    .from('auction_state')
    .select('status, current_auction_pokemon_id')
    .eq('event_id', eventId)
    .single()

  if (state?.status === 'BIDDING' && state.current_auction_pokemon_id) {
    const { error: cancelError } = await auth.supabase
      .from('auction_pokemon')
      .update({ status: 'CANCELLED' })
      .eq('id', state.current_auction_pokemon_id)

    if (cancelError) {
      return { success: false, error: 'Failed to cancel the active auction before assigning.' }
    }
  }

  // Create an auction_pokemon record for this host assignment (SOLD immediately)
  const { data: auctionPokemon, error: apError } = await auth.supabase
    .from('auction_pokemon')
    .insert({
      event_id:                    eventId,
      species_id:                  speciesId,
      name_snapshot:               pokemon.name,
      sprite_snapshot:             pokemon.sprite_front,
      is_mega_capable:             pokemon.is_mega_capable,
      nominated_by:                'HOST',
      nominated_by_participant_id: null,
      status:                      'SOLD',
      sold_to:                     participantId,
      sold_price:                  0,
    })
    .select('id')
    .single()

  if (apError || !auctionPokemon) {
    return { success: false, error: 'Failed to create auction record.' }
  }

  // Assign the pokemon to the participant's team at $0 (host override)
  const { error: teamError } = await auth.supabase
    .from('team_pokemon')
    .insert({
      event_id:           eventId,
      participant_id:     participantId,
      species_id:         speciesId,
      name_snapshot:      pokemon.name,
      sprite_snapshot:    pokemon.sprite_front,
      is_mega_capable:    pokemon.is_mega_capable,
      purchase_price:     0,
      auction_pokemon_id: auctionPokemon.id,
    })

  if (teamError) {
    return { success: false, error: 'Failed to assign pokemon to team.' }
  }

  // Fulfil mega requirement if applicable
  if (pokemon.is_mega_capable) {
    await auth.supabase
      .from('participants')
      .update({ has_mega: true })
      .eq('id', participantId)
  }

  // Gifting must NOT consume the current turn. Only reset auction_state if we
  // cancelled an active bidding above (back to IDLE on the SAME turn); a gift
  // during a quiet nomination turn leaves the turn and its timer untouched.
  if (state?.status === 'BIDDING' && state.current_auction_pokemon_id) {
    await auth.supabase
      .from('auction_state')
      .update({
        status:                     'IDLE',
        current_auction_pokemon_id: null,
        timer_ends_at:              null,
      })
      .eq('event_id', eventId)
  }

  // Gifting a mega-capable pokemon can complete the MEGA phase.
  await checkMegaPhase(eventId)

  return { success: true }
}

// ---------------------------------------------------------------------------
// advancePhase — manually move the auction to the next phase.
// Valid transitions: WAITING→MEGA, MEGA→MAIN, MAIN→SPECIAL, SPECIAL→ENDED.
// Requires no active auction (cancel first if needed).
// ---------------------------------------------------------------------------
const NEXT_PHASE: Partial<Record<AuctionPhase, AuctionPhase>> = {
  WAITING: 'MEGA',
  MEGA:    'MAIN',
  MAIN:    'SPECIAL',
  SPECIAL: 'ENDED',
}

export async function advancePhaseAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: state, error: stateError } = await auth.supabase
    .from('auction_state')
    .select('phase, status')
    .eq('event_id', eventId)
    .single()

  if (stateError || !state) {
    return { success: false, error: 'Auction state not found.' }
  }

  if (state.status === 'BIDDING') {
    return {
      success: false,
      error:   'An auction is in progress. Cancel it before advancing the phase.',
    }
  }

  const nextPhase = NEXT_PHASE[state.phase as AuctionPhase]
  if (!nextPhase) {
    return { success: false, error: `Cannot advance from phase: ${state.phase}.` }
  }

  const { error: updateError } = await auth.supabase
    .from('auction_state')
    .update({
      phase:  nextPhase,
      status: 'IDLE',
    })
    .eq('event_id', eventId)

  if (updateError) {
    return { success: false, error: 'Failed to advance phase.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// resolveAuction — settle the current auction (assign to highest bidder, deduct
// budget, advance turn). Idempotent via the resolve_auction RPC. Triggered by
// the host panel when the timer hits 0.
// ---------------------------------------------------------------------------
export async function resolveAuctionAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const result = await resolveAuction(eventId)
  if (!result.success) return { success: false, error: result.error }

  return { success: true }
}

// ---------------------------------------------------------------------------
// resetToWaiting — returns the whole event to its pre-start (WAITING) state.
// Clears draft data + restores budgets. Host-gated; runs via the service-role
// client (server-side only) so it can clear append-only/locked tables cleanly.
// ---------------------------------------------------------------------------
export async function resetToWaitingAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  // Clear the auction_state FK references FIRST (current_turn_id →
  // auction_turns, current_auction_pokemon_id → auction_pokemon), otherwise the
  // deletes below fail the FK constraint and leave orphan rows.
  await adminClient
    .from('auction_state')
    .update({
      phase:                      'WAITING',
      status:                     'IDLE',
      current_turn_id:            null,
      current_auction_pokemon_id: null,
      timer_ends_at:              null,
      paused_at:                  null,
      host_override_active:       false,
    })
    .eq('event_id', eventId)

  await adminClient.from('bids').delete().eq('event_id', eventId)
  await adminClient.from('team_pokemon').delete().eq('event_id', eventId)
  await adminClient.from('auction_pokemon').delete().eq('event_id', eventId)
  await adminClient.from('auction_turns').delete().eq('event_id', eventId)

  await adminClient
    .from('participants')
    .update({
      budget:              AUCTION_CONFIG.INITIAL_BUDGET,
      has_mega:            false,
      special_session_won: false,
    })
    .eq('event_id', eventId)

  return { success: true }
}

// ---------------------------------------------------------------------------
// undoLastBid — deletes the most recent bid on the active auction and resets
// the timer. Host-only escape hatch for bid entry mistakes.
// ---------------------------------------------------------------------------
export async function undoLastBidAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: state, error: stateError } = await auth.supabase
    .from('auction_state')
    .select('status, current_auction_pokemon_id')
    .eq('event_id', eventId)
    .single()

  if (stateError || !state) return { success: false, error: 'Auction state not found.' }
  if (state.status !== 'BIDDING') return { success: false, error: 'No active auction.' }
  if (!state.current_auction_pokemon_id) return { success: false, error: 'No active auction pokemon.' }

  const { data: lastBid, error: bidError } = await auth.supabase
    .from('bids')
    .select('id')
    .eq('event_id', eventId)
    .eq('auction_pokemon_id', state.current_auction_pokemon_id)
    .order('placed_at', { ascending: false })
    .limit(1)
    .single()

  if (bidError || !lastBid) return { success: false, error: 'No bids to undo.' }

  const { error: deleteError } = await adminClient
    .from('bids')
    .delete()
    .eq('id', lastBid.id)

  if (deleteError) return { success: false, error: 'Failed to undo bid.' }

  // Reset timer so participants have a fresh window to rebid
  const timerEndsAt = new Date(
    Date.now() + AUCTION_CONFIG.TIMER_SECONDS * 1000
  ).toISOString()

  const { error: timerError } = await auth.supabase
    .from('auction_state')
    .update({ timer_ends_at: timerEndsAt })
    .eq('event_id', eventId)

  if (timerError) return { success: false, error: 'Failed to reset timer.' }

  return { success: true }
}

// ---------------------------------------------------------------------------
// pauseAuction — freezes the bidding timer.
// The cron / edge function that calls resolve_auction will skip while paused.
// ---------------------------------------------------------------------------
export async function pauseAuctionAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: state, error: stateError } = await auth.supabase
    .from('auction_state')
    .select('status, paused_at, timer_ends_at')
    .eq('event_id', eventId)
    .single()

  if (stateError || !state) return { success: false, error: 'Auction state not found.' }
  // Pause works during bidding AND during a nomination turn (IDLE + running
  // nomination timer). Either way there must be a live timer to freeze.
  if (state.status !== 'BIDDING' && state.status !== 'IDLE') {
    return { success: false, error: 'No active auction to pause.' }
  }
  if (!state.timer_ends_at) return { success: false, error: 'No hay temporizador activo para pausar.' }
  if (state.paused_at) return { success: false, error: 'Auction is already paused.' }

  const { error } = await auth.supabase
    .from('auction_state')
    .update({ paused_at: new Date().toISOString() })
    .eq('event_id', eventId)

  if (error) return { success: false, error: 'Failed to pause auction.' }

  return { success: true }
}

// ---------------------------------------------------------------------------
// resumeAuction — unfreezes the bidding timer.
// Recalculates timer_ends_at so participants have the remaining time left.
// ---------------------------------------------------------------------------
export async function resumeAuctionAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: state, error: stateError } = await auth.supabase
    .from('auction_state')
    .select('status, paused_at, timer_ends_at')
    .eq('event_id', eventId)
    .single()

  if (stateError || !state) return { success: false, error: 'Auction state not found.' }
  if (!state.paused_at) return { success: false, error: 'Auction is not paused.' }

  const remainingMs = state.timer_ends_at
    ? Date.parse(state.timer_ends_at) - Date.parse(state.paused_at)
    : AUCTION_CONFIG.TIMER_SECONDS * 1000

  // Guarantee at least 10 s so the resumed timer is visible
  const newTimerEndsAt = new Date(
    Date.now() + Math.max(remainingMs, 10_000)
  ).toISOString()

  const { error } = await auth.supabase
    .from('auction_state')
    .update({ paused_at: null, timer_ends_at: newTimerEndsAt })
    .eq('event_id', eventId)

  if (error) return { success: false, error: 'Failed to resume auction.' }

  return { success: true }
}

// ---------------------------------------------------------------------------
// removeTeamPokemon — removes a pokemon from a participant's team and refunds
// the purchase price back to their budget.
// ---------------------------------------------------------------------------
export async function removeTeamPokemonAction(
  eventId:       string,
  teamPokemonId: string,
): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: tp, error: tpError } = await adminClient
    .from('team_pokemon')
    .select('id, participant_id, purchase_price, is_mega_capable, event_id')
    .eq('id', teamPokemonId)
    .eq('event_id', eventId)
    .single()

  if (tpError || !tp) return { success: false, error: 'Team pokemon not found.' }

  const { error: deleteError } = await adminClient
    .from('team_pokemon')
    .delete()
    .eq('id', teamPokemonId)

  if (deleteError) return { success: false, error: 'Failed to remove pokemon from team.' }

  // Re-fetch current budget and add refund (no SQL arithmetic in typed client)
  const { data: participant } = await adminClient
    .from('participants')
    .select('budget')
    .eq('id', tp.participant_id)
    .single()

  const newBudget = (participant?.budget ?? 0) + tp.purchase_price

  await adminClient
    .from('participants')
    .update({ budget: newBudget })
    .eq('id', tp.participant_id)

  if (tp.is_mega_capable) {
    const { count: megaCount } = await adminClient
      .from('team_pokemon')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('participant_id', tp.participant_id)
      .eq('is_mega_capable', true)

    if ((megaCount ?? 0) === 0) {
      await adminClient
        .from('participants')
        .update({ has_mega: false })
        .eq('id', tp.participant_id)
    }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// undoLastRound — reverses the last resolved auction: removes the team_pokemon,
// refunds the budget, deletes bids, and rolls back the turn pointer by one.
// Only allowed when no auction is currently active (status = IDLE/NOMINATING).
// Note: does NOT reverse a phase transition (e.g. MEGA→MAIN).
// ---------------------------------------------------------------------------
export async function undoLastRoundAction(eventId: string): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: state, error: stateError } = await auth.supabase
    .from('auction_state')
    .select('status, current_turn_id')
    .eq('event_id', eventId)
    .single()

  if (stateError || !state) return { success: false, error: 'Auction state not found.' }
  if (state.status === 'BIDDING' || state.status === 'RESOLVING') {
    return { success: false, error: 'Cannot undo while an auction is in progress.' }
  }

  // Find the last SOLD auction_pokemon that has a team_pokemon entry
  const { data: lastAP, error: apError } = await adminClient
    .from('auction_pokemon')
    .select('id, is_mega_capable, name_snapshot, sold_price')
    .eq('event_id', eventId)
    .eq('status', 'SOLD')
    .order('nominated_at', { ascending: false })
    .limit(1)
    .single()

  if (apError || !lastAP) return { success: false, error: 'No completed rounds to undo.' }

  const { data: tp, error: tpError } = await adminClient
    .from('team_pokemon')
    .select('id, participant_id, purchase_price')
    .eq('auction_pokemon_id', lastAP.id)
    .single()

  if (tpError || !tp) return { success: false, error: 'Team pokemon record not found for last round.' }

  // Reverse: delete team_pokemon
  await adminClient.from('team_pokemon').delete().eq('id', tp.id)

  // Reverse: delete all bids for this auction
  await adminClient.from('bids').delete().eq('auction_pokemon_id', lastAP.id)

  // Reverse: mark auction_pokemon as CANCELLED
  await adminClient
    .from('auction_pokemon')
    .update({ status: 'CANCELLED', sold_to: null, sold_price: null })
    .eq('id', lastAP.id)

  // Reverse: refund budget
  const { data: participant } = await adminClient
    .from('participants')
    .select('budget')
    .eq('id', tp.participant_id)
    .single()

  await adminClient
    .from('participants')
    .update({ budget: (participant?.budget ?? 0) + tp.purchase_price })
    .eq('id', tp.participant_id)

  // Reverse: has_mega flag if applicable
  if (lastAP.is_mega_capable) {
    const { count: megaCount } = await adminClient
      .from('team_pokemon')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('participant_id', tp.participant_id)
      .eq('is_mega_capable', true)

    if ((megaCount ?? 0) === 0) {
      await adminClient
        .from('participants')
        .update({ has_mega: false })
        .eq('id', tp.participant_id)
    }
  }

  // Roll back turn: current_turn_id points to the NEXT turn after resolve;
  // we need to go back one position to restore the nominator's turn.
  const { data: allTurns } = await adminClient
    .from('auction_turns')
    .select('id, position')
    .eq('event_id', eventId)
    .order('position', { ascending: true })

  if (allTurns && allTurns.length > 0 && state.current_turn_id) {
    const current = allTurns.find(t => t.id === state.current_turn_id)
    if (current) {
      const maxPos    = allTurns[allTurns.length - 1].position
      const prevPos   = current.position === 0 ? maxPos : current.position - 1
      const prevTurn  = allTurns.find(t => t.position === prevPos)

      if (prevTurn) {
        await adminClient
          .from('auction_state')
          .update({
            current_turn_id:            prevTurn.id,
            status:                     'IDLE',
            current_auction_pokemon_id: null,
            timer_ends_at:              null,
            paused_at:                  null,
          })
          .eq('event_id', eventId)
      }
    }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// nominateHost — host nominates a pokemon to open a new auction round.
// Used when the current participant delegates nomination to the host.
// participantId: the participant on whose turn this falls; if no bids come in,
// resolve_auction assigns the pokemon to them at MIN_BID.
// ---------------------------------------------------------------------------
export async function nominateHostAction(
  eventId:       string,
  speciesId:     number,
  participantId: string | null = null,
): Promise<ActionResult> {
  const auth = await requireHost()
  if (!auth.ok) return { success: false, error: auth.error }

  const { data: state, error: stateError } = await auth.supabase
    .from('auction_state')
    .select('phase, status')
    .eq('event_id', eventId)
    .single()

  if (stateError || !state) return { success: false, error: 'Auction state not found.' }
  if (state.status === 'BIDDING') return { success: false, error: 'An auction is already in progress.' }
  if (state.phase !== 'MEGA' && state.phase !== 'MAIN') {
    return { success: false, error: `Cannot nominate during the ${state.phase} phase.` }
  }

  const validation = await validateNomination({ eventId, speciesId, nominatedBy: 'HOST' })
  if (!validation.valid) return { success: false, error: validation.reason }

  const { data: pokemon, error: pokemonError } = await auth.supabase
    .from('pokemon_meta')
    .select('name, sprite_front, is_mega_capable')
    .eq('species_id', speciesId)
    .single()

  if (pokemonError || !pokemon) return { success: false, error: 'Pokemon not found.' }

  const { data: auctionPokemon, error: insertError } = await adminClient
    .from('auction_pokemon')
    .insert({
      event_id:                    eventId,
      species_id:                  speciesId,
      name_snapshot:               pokemon.name,
      sprite_snapshot:             pokemon.sprite_front,
      is_mega_capable:             pokemon.is_mega_capable,
      nominated_by:                'HOST' as const,
      nominated_by_participant_id: participantId,
      status:                      'ACTIVE',
    })
    .select('id')
    .single()

  if (insertError || !auctionPokemon) return { success: false, error: 'Failed to create auction.' }

  const timerEndsAt = new Date(
    Date.now() + AUCTION_CONFIG.TIMER_SECONDS * 1000
  ).toISOString()

  const { error: stateUpdateError } = await adminClient
    .from('auction_state')
    .update({
      status:                     'BIDDING',
      current_auction_pokemon_id: auctionPokemon.id,
      timer_ends_at:              timerEndsAt,
    })
    .eq('event_id', eventId)

  if (stateUpdateError) return { success: false, error: 'Failed to open bidding.' }

  return { success: true }
}
