'use client'

import { useEffect, useState } from 'react'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { SearchModal } from './SearchModal'
import { nominateAction } from '@/features/auction/actions/nominate.action'
import { bidAction } from '@/features/auction/actions/bid.action'
import { getSnapshotAction } from '@/features/auction/actions/snapshot.action'
import { AUCTION_CONFIG } from '@/lib/config/auction.config'
import type { BidRow, TeamPokemonRow } from '@/types/auction.types'

const SLOTS = [0, 1, 2, 3, 4, 5]
const COOLDOWN_MS = AUCTION_CONFIG.BID_COOLDOWN_SECS * 1000

// DEV-only sample team to preview filled slots + the mega icon without a draft.
const sprite = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
const MOCK_TEAM: TeamPokemonRow[] = [
  { id: 'm1', event_id: '', participant_id: '', species_id: 6,   name_snapshot: 'Charizard', sprite_snapshot: sprite(6),   is_mega_capable: true,  purchase_price: 0, auction_pokemon_id: '' },
  { id: 'm2', event_id: '', participant_id: '', species_id: 25,  name_snapshot: 'Pikachu',   sprite_snapshot: sprite(25),  is_mega_capable: false, purchase_price: 0, auction_pokemon_id: '' },
  { id: 'm3', event_id: '', participant_id: '', species_id: 282, name_snapshot: 'Gardevoir', sprite_snapshot: sprite(282), is_mega_capable: true,  purchase_price: 0, auction_pokemon_id: '' },
  { id: 'm4', event_id: '', participant_id: '', species_id: 143, name_snapshot: 'Snorlax',   sprite_snapshot: sprite(143), is_mega_capable: false, purchase_price: 0, auction_pokemon_id: '' },
]

export function InEventScreen({
  userId,
  eventId,
  dev = false,
}: {
  userId: string
  eventId: string
  dev?: boolean
}) {
  const participants = useAuctionStore((s) => s.participants)
  const state        = useAuctionStore((s) => s.state)
  const turns        = useAuctionStore((s) => s.turns)
  const currentBids  = useAuctionStore((s) => s.currentBids)
  const setSnapshot  = useAuctionStore((s) => s.setSnapshot)

  const [searchOpen, setSearchOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [bidValue, setBidValue] = useState<number>(AUCTION_CONFIG.MIN_BID)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  // Tick while a cooldown is active.
  useEffect(() => {
    if (Date.now() >= cooldownUntil) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [cooldownUntil])

  const me = participants.find((p) => p.user_id === userId)
  const realTeam = me?.team ?? []
  const team = dev && realTeam.length === 0 ? MOCK_TEAM : realTeam
  const budget = me?.budget ?? 0

  const isBidding = state?.status === 'BIDDING'
  const currentTurn = turns.find((t) => t.id === state?.current_turn_id)
  const turnParticipant = participants.find((p) => p.id === currentTurn?.participant_id)
  const isMyTurn = !!turnParticipant && turnParticipant.user_id === userId

  let dynamicText: string
  if (isBidding) dynamicText = 'Pujando'
  else if (!currentTurn) dynamicText = 'Esperando…'
  else if (isMyTurn) dynamicText = 'Es tu turno :D'
  else dynamicText = `Turno de ${turnParticipant?.display_name ?? '—'}`

  const topBid = currentBids.reduce<BidRow | null>(
    (max, b) => (b.amount > (max?.amount ?? -1) ? b : max),
    null,
  )
  const topBidder = topBid
    ? participants.find((p) => p.id === topBid.participant_id)
    : null

  const canNominate = isMyTurn && !isBidding
  const canSearch = canNominate || dev

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const inCooldown = cooldownLeft > 0
  const canBid = isBidding && !inCooldown && !busy && !!state?.current_auction_pokemon_id

  // Reset the textbox to the opening minimum when a new auction (pokemon) starts.
  const auctionPokemonId = state?.current_auction_pokemon_id ?? null
  useEffect(() => {
    setBidValue(AUCTION_CONFIG.MIN_BID)
  }, [auctionPokemonId])

  // The textbox floor follows the current highest bid (opening floor = MIN_BID).
  const minBid = topBid?.amount ?? AUCTION_CONFIG.MIN_BID
  useEffect(() => {
    setBidValue((v) => Math.max(v, minBid))
  }, [minBid])

  async function refresh() {
    const snap = await getSnapshotAction(eventId)
    if (snap.success) setSnapshot(snap.data)
  }

  // The +25/+50/+100 buttons just bump the textbox amount.
  const addToBid = (inc: number) => setBidValue((v) => v + inc)

  async function placeBid() {
    if (!canBid || !state?.current_auction_pokemon_id) return
    setBusy(true)
    const r = await bidAction({
      eventId,
      auctionPokemonId: state.current_auction_pokemon_id,
      amount: bidValue, // the textbox is the exact bid, not an increment
    })
    setBusy(false)
    if (!r.success) {
      alert(r.error)
      return
    }
    setCooldownUntil(Date.now() + COOLDOWN_MS)
    setNow(Date.now())
    refresh()
  }

  async function nominate(speciesId: number) {
    setSearchOpen(false)
    if (!canNominate) return // dev preview without a real turn
    const r = await nominateAction({ eventId, speciesId })
    if (!r.success) {
      alert(r.error)
      return
    }
    refresh()
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-7 overflow-y-auto bg-[#09090b] px-0 py-8">
      <h1 className="text-3xl font-bold text-white [text-shadow:0px_0px_10px_rgba(255,255,255,1)]">
        Tu equipo
      </h1>

      {/* Team grid — 6 slots */}
      <div className="grid grid-cols-3 gap-5">
        {SLOTS.map((i) => {
          const mon = team[i]
          return (
            <div
              key={i}
              className="relative flex h-24 w-24 items-center justify-center rounded-lg bg-[#09090b] outline outline-2 -outline-offset-2 outline-[#374151]"
            >
              {mon?.sprite_snapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mon.sprite_snapshot}
                  alt={mon.name_snapshot}
                  className="h-25 w-25 object-contain"
                />
              ) : (
                <svg viewBox="0 0 100 100" aria-hidden className="h-20 w-20 text-[#101116]">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="5" />
                  <line x1="12" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="5" />
                  <circle cx="50" cy="50" r="13" fill="#09090b" stroke="currentColor" strokeWidth="5" />
                </svg>
              )}
              {mon?.is_mega_capable && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/mega.png"
                  alt="Mega"
                  className="pointer-events-none absolute -left-2 -top-3 h-16 w-auto"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Center — dynamic text + best bid + budget */}
      <div className="flex flex-col items-center gap-4 pt-2">
        <p className="text-center text-3xl font-bold text-white [text-shadow:0px_0px_10px_rgba(255,255,255,1)]">
          {dynamicText}
        </p>

        <p className="text-center text-xl font-bold text-white [text-shadow:0px_0px_5px_rgba(255,255,255,1)]">
          Puja mas grande:
          <br />
          {topBid ? `${topBid.amount}$ · ${topBidder?.display_name ?? '—'}` : '—'}
        </p>

        <div className="flex h-11 items-center gap-1.5 rounded-[10px] bg-[#09090b] px-3 outline outline-2 -outline-offset-2 outline-[#374151]">
          <span className="text-xl font-medium text-white [text-shadow:0px_0px_5px_rgba(255,255,255,1)]">
            {budget}
          </span>
          <span className="text-xl font-bold text-white">₽</span>
        </div>
      </div>

      {/* Buscar — nominate (enabled only on your turn) */}
      <button
        type="button"
        disabled={!canSearch}
        onClick={() => setSearchOpen(true)}
        className={
          canSearch
            ? 'h-16 w-80 rounded-xl bg-[#111827] text-2xl font-semibold text-indigo-300 shadow-[0px_0px_46px_0px_rgba(38,76,144,0.25)] outline outline-2 -outline-offset-2 outline-[#1e3a8a]'
            : 'h-16 w-80 rounded-xl bg-[#171717] text-2xl font-medium text-neutral-400/25 outline outline-2 -outline-offset-2 outline-[#525252]'
        }
      >
        Buscar
      </button>

      {/* Bid controls — the textbox is the exact bid; +N bumps it; › submits.
          Enabled only while bidding (2s cooldown between submits). */}
      <div className="flex w-full max-w-[25rem] flex-col items-center gap-4 px-2">
        <div className="flex w-full items-center gap-3">
          <div className="flex h-14 flex-1 items-center rounded-xl bg-[#09090b] px-4 outline outline-2 -outline-offset-2 outline-[#374151]">
            <input
              type="number"
              min={minBid}
              disabled={!isBidding}
              value={bidValue}
              onChange={(e) => setBidValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full bg-transparent text-lg font-bold text-slate-100/60 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-lg font-bold text-slate-100/60">₽</span>
          </div>
          <button
            type="button"
            disabled={!canBid}
            onClick={placeBid}
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#171717] text-2xl text-lime-200 shadow-[0px_0px_8px_0px_rgba(48,110,25,0.25)] outline outline-2 -outline-offset-2 outline-[#166534] disabled:opacity-40"
          >
            {inCooldown ? cooldownLeft : '›'}
          </button>
        </div>

        <div className="flex w-full items-center gap-4">
          {[25, 50, 100].map((inc) => (
            <button
              key={inc}
              type="button"
              disabled={!isBidding}
              onClick={() => addToBid(inc)}
              className="h-20 flex-1 rounded-xl bg-[#171717] text-2xl font-semibold text-lime-200 shadow-[0px_0px_46px_0px_rgba(48,110,25,0.25)] outline outline-2 -outline-offset-2 outline-[#3f6212] [text-shadow:0px_0px_10px_rgba(188,227,146,0.25)] disabled:opacity-40"
            >
              +{inc}
            </button>
          ))}
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={nominate} />
    </main>
  )
}
