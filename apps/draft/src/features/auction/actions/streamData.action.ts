'use server'

import { adminClient } from '@/lib/supabase/admin'
import type { AuctionPhase, AuctionStatus } from '@/types/auction.types'

export type StreamStat = { label: string; value: number }
export type StreamData = {
  phase: AuctionPhase | null
  status: AuctionStatus | null
  timerEndsAt: string | null
  participants: {
    id: string
    name: string
    team: { speciesId: number; sprite: string | null; mega: boolean }[]
  }[]
  pokemon: {
    name: string
    spriteHome: string | null
    types: string[]
    stats: StreamStat[]
    total: number
  } | null
  topBids: ({ name: string; amount: number } | null)[]
}

// Public read for the /stream display — no auth, so it uses the service-role
// client (the stream shows public event data screen-shared in Discord).
export async function getStreamDataAction(): Promise<StreamData | null> {
  const { data: events } = await adminClient
    .from('events')
    .select('id')
    .neq('status', 'ARCHIVED')
    .order('created_at', { ascending: true })
    .limit(1)
  const eventId = events?.[0]?.id
  if (!eventId) return null

  const [stateR, partsR, teamR] = await Promise.all([
    adminClient.from('auction_state').select('*').eq('event_id', eventId).single(),
    adminClient.from('participants').select('id, display_name').eq('event_id', eventId),
    adminClient
      .from('team_pokemon')
      .select('participant_id, species_id, sprite_snapshot, is_mega_capable')
      .eq('event_id', eventId),
  ])

  const state = stateR.data
  const team = teamR.data ?? []

  const participants = (partsR.data ?? [])
    .map((p) => ({
      id: p.id,
      name: p.display_name,
      team: team
        .filter((t) => t.participant_id === p.id)
        .map((t) => ({
          speciesId: t.species_id,
          sprite: t.sprite_snapshot,
          mega: t.is_mega_capable,
        })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  let pokemon: StreamData['pokemon'] = null
  let topBids: StreamData['topBids'] = [null, null, null]

  const currentId = state?.current_auction_pokemon_id
  if (currentId) {
    const [apR, bidsR] = await Promise.all([
      adminClient.from('auction_pokemon').select('species_id, name_snapshot').eq('id', currentId).single(),
      adminClient.from('bids').select('participant_id, amount').eq('auction_pokemon_id', currentId),
    ])

    if (apR.data) {
      const { data: meta } = await adminClient
        .from('pokemon_meta')
        .select('sprite_home, types, hp, attack, defense, special_attack, special_defense, speed')
        .eq('species_id', apR.data.species_id)
        .single()

      const s = meta
      const stats: StreamStat[] = [
        { label: 'HP', value: s?.hp ?? 0 },
        { label: 'Ataque', value: s?.attack ?? 0 },
        { label: 'Defensa', value: s?.defense ?? 0 },
        { label: 'Ataque Especial', value: s?.special_attack ?? 0 },
        { label: 'Defensa Especial', value: s?.special_defense ?? 0 },
        { label: 'Velocidad', value: s?.speed ?? 0 },
      ]
      pokemon = {
        name: apR.data.name_snapshot,
        spriteHome: s?.sprite_home ?? null,
        types: (s?.types as string[] | null) ?? [],
        stats,
        total: stats.reduce((sum, st) => sum + st.value, 0),
      }
    }

    // Top 3 bids (best per participant).
    const partName = new Map((partsR.data ?? []).map((p) => [p.id, p.display_name]))
    const best = new Map<string, number>()
    ;(bidsR.data ?? []).forEach((b) =>
      best.set(b.participant_id, Math.max(best.get(b.participant_id) ?? 0, b.amount)),
    )
    const ranked = [...best.entries()]
      .map(([pid, amount]) => ({ name: partName.get(pid) ?? '—', amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
    topBids = [ranked[0] ?? null, ranked[1] ?? null, ranked[2] ?? null]
  }

  return {
    phase: (state?.phase as AuctionPhase | null) ?? null,
    status: (state?.status as AuctionStatus | null) ?? null,
    timerEndsAt: state?.timer_ends_at ?? null,
    participants,
    pokemon,
    topBids,
  }
}
