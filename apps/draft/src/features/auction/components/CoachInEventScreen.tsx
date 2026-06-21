'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { SearchModal } from './SearchModal'
import { nominateAction } from '@/features/auction/actions/nominate.action'
import { getSnapshotAction } from '@/features/auction/actions/snapshot.action'
import type { BidRow } from '@/types/auction.types'

const SLOTS = [0, 1, 2, 3, 4, 5]

export function CoachInEventScreen({
  counterpartUserId,
  eventId,
}: {
  counterpartUserId: string | null
  eventId: string
}) {
  const participants = useAuctionStore((s) => s.participants)
  const state = useAuctionStore((s) => s.state)
  const turns = useAuctionStore((s) => s.turns)
  const currentBids = useAuctionStore((s) => s.currentBids)
  const setSnapshot = useAuctionStore((s) => s.setSnapshot)

  const [searchOpen, setSearchOpen] = useState(false)
  const [overrides, setOverrides] = useState<number | null>(null)

  const managed = participants.find((p) => p.user_id === counterpartUserId)
  const team = managed?.team ?? []
  const budget = managed?.budget ?? 0

  const topBid = currentBids.reduce<BidRow | null>(
    (max, b) => (b.amount > (max?.amount ?? -1) ? b : max),
    null,
  )
  const topBidder = topBid
    ? participants.find((p) => p.id === topBid.participant_id)
    : null

  // Coach's remaining objections (from coach_participants).
  useEffect(() => {
    if (!managed) return
    supabase
      .from('coach_participants')
      .select('overrides_remaining')
      .eq('event_id', eventId)
      .eq('participant_id', managed.id)
      .maybeSingle()
      .then(({ data }) => setOverrides(data?.overrides_remaining ?? null))
  }, [managed?.id, eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  const isBidding = state?.status === 'BIDDING'
  const isPaused = !!state?.paused_at
  const currentTurn = turns.find((t) => t.id === state?.current_turn_id)
  const isManagedTurn = !!currentTurn && !!managed && currentTurn.participant_id === managed.id
  const nameOf = (pid: string | undefined) =>
    participants.find((p) => p.id === pid)?.display_name ?? '—'

  let dynamicText: string
  if (isPaused) dynamicText = 'En pausa ⏸'
  else if (isBidding) dynamicText = 'Pujando'
  else if (!currentTurn) dynamicText = 'Esperando…'
  else dynamicText = `Turno de ${nameOf(currentTurn.participant_id)}`

  const hasOverrides = (overrides ?? 0) > 0
  // Objeción only once the invalido has already put a pokemon up (BIDDING),
  // and never while the host has the auction paused.
  const canObject = isManagedTurn && isBidding && hasOverrides && !isPaused

  async function object(speciesId: number) {
    setSearchOpen(false)
    if (!canObject || !managed) return
    const r = await nominateAction({ eventId, speciesId })
    if (!r.success) {
      alert(r.error)
      return
    }
    const { data } = await supabase
      .from('coach_participants')
      .select('overrides_remaining')
      .eq('event_id', eventId)
      .eq('participant_id', managed.id)
      .maybeSingle()
    setOverrides(data?.overrides_remaining ?? 0)
    const snap = await getSnapshotAction(eventId)
    if (snap.success) setSnapshot(snap.data)
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-7 overflow-y-auto bg-[#09090b] px-0 py-8">
      <h1 className="text-3xl font-bold text-white [text-shadow:0px_0px_10px_rgba(255,255,255,1)]">
        Tu equipo
      </h1>

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
                <img src={mon.sprite_snapshot} alt={mon.name_snapshot} className="h-25 w-25 object-contain" />
              ) : (
                <svg viewBox="0 0 100 100" aria-hidden className="h-20 w-20 text-[#101116]">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="5" />
                  <line x1="12" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="5" />
                  <circle cx="50" cy="50" r="13" fill="#09090b" stroke="currentColor" strokeWidth="5" />
                </svg>
              )}
              {mon?.is_mega_capable && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/mega.png" alt="Mega" className="pointer-events-none absolute -left-2 -top-3 h-16 w-auto" />
              )}
            </div>
          )
        })}
      </div>

      {/* Center — dynamic text + best bid + the invalido's budget */}
      <div className="flex flex-col items-center gap-4 pt-2">
        <p className="text-center text-3xl font-bold text-white [text-shadow:0px_0px_10px_rgba(255,255,255,1)]">
          {dynamicText}
        </p>

        <p className="text-center text-xl font-bold text-white [text-shadow:0px_0px_5px_rgba(255,255,255,1)]">
          Mejor postor/a:
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

      {/* Objeción — coach override; disappears once used up */}
      {hasOverrides && (
        <div className="mt-auto flex flex-col items-center gap-3 pb-2">
          <p className="text-sm font-medium text-white">
            Este es tu boton de objecion, solo tienes 1.
          </p>
          <button
            type="button"
            disabled={!canObject}
            onClick={() => setSearchOpen(true)}
            className={
              canObject
                ? 'h-16 w-80 rounded-xl bg-[#111827] text-2xl font-semibold text-indigo-300 shadow-[0px_0px_46px_0px_rgba(38,76,144,0.25)] outline outline-2 -outline-offset-2 outline-[#1e3a8a]'
                : 'h-16 w-80 rounded-xl bg-[#171717] text-2xl font-medium text-neutral-400/25 outline outline-2 -outline-offset-2 outline-[#525252]'
            }
          >
            ¡OBJECIÓN!
          </button>
        </div>
      )}

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={object} />
    </main>
  )
}
