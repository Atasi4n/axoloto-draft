'use client'

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react'
import { Check, Gift, Ban, Pencil } from 'lucide-react'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { SearchModal } from '@/features/auction/components/SearchModal'
import {
  assignPokemonAction,
  removeTeamPokemonAction,
  editBudgetAction,
} from '@/features/auction/actions/host.actions'
import { getSnapshotAction } from '@/features/auction/actions/snapshot.action'

const SLOTS = [0, 1, 2, 3, 4, 5]

type Props = {
  eventId:          string
  participantId:    string
  autoSkip:         boolean
  onToggleAutoSkip: () => void
  onClose:          () => void
}

export function EditTeamModal({
  eventId,
  participantId,
  autoSkip,
  onToggleAutoSkip,
  onClose,
}: Props) {
  const participants = useAuctionStore((s) => s.participants)
  const setSnapshot = useAuctionStore((s) => s.setSnapshot)

  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [searchOpen, setSearchOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const participant = participants.find((p) => p.id === participantId)
  if (!participant) return null

  const team = participant.team ?? []
  const teamFull = team.length >= 6

  async function refresh() {
    const snap = await getSnapshotAction(eventId)
    if (snap.success) setSnapshot(snap.data)
  }

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function gift(speciesId: number) {
    setSearchOpen(false)
    if (busy) return
    setBusy(true)
    const r = await assignPokemonAction(eventId, speciesId, participantId)
    if (!r.success) alert(r.error)
    else await refresh()
    setBusy(false)
  }

  async function removeChecked() {
    if (busy || checked.size === 0) return
    setBusy(true)
    for (const id of checked) {
      const r = await removeTeamPokemonAction(eventId, id)
      if (!r.success) {
        alert(r.error)
        break
      }
    }
    await refresh()
    setChecked(new Set())
    setBusy(false)
  }

  function editBudget() {
    const input = window.prompt('Nuevo presupuesto:', String(participant?.budget ?? 0))
    if (input == null) return
    const amount = parseInt(input, 10)
    if (Number.isNaN(amount)) return
    setBusy(true)
    editBudgetAction(eventId, participantId, amount).then(async (r) => {
      if (!r.success) alert(r.error)
      else await refresh()
      setBusy(false)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col gap-8 rounded-[20px] bg-[#111827] p-10 shadow-[0px_0px_46px_0px_rgba(38,76,144,0.25)] outline outline-[3px] -outline-offset-[3px] outline-[#1e3a8a]"
      >
        {/* Header: name + editable budget */}
        <div className="flex items-center justify-between gap-8">
          <h2 className="text-3xl font-medium text-white [text-shadow:0px_0px_20px_rgba(255,255,255,1)]">
            {participant.display_name}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={editBudget}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#09090b] px-3 py-2 text-[#9fd47f] hover:bg-[#15151c] disabled:opacity-50"
          >
            <span className="text-lg font-medium">{participant.budget}₽</span>
            <Pencil className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Team grid with delete checkboxes */}
        <div className="grid grid-cols-3 gap-7">
          {SLOTS.map((i) => {
            const mon = team[i]
            const isChecked = mon ? checked.has(mon.id) : false
            return (
              <div
                key={i}
                className="relative flex h-32 w-32 items-center justify-center rounded-xl bg-[#09090b] outline outline-[3px] -outline-offset-[3px] outline-[#374151]"
              >
                {mon?.sprite_snapshot ? (
                  <img
                    src={mon.sprite_snapshot}
                    alt={mon.name_snapshot}
                    className="h-28 w-28 object-contain"
                  />
                ) : (
                  <svg viewBox="0 0 100 100" aria-hidden className="h-20 w-20 text-[#101116]">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="5" />
                    <line x1="12" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="5" />
                    <circle cx="50" cy="50" r="13" fill="#09090b" stroke="currentColor" strokeWidth="5" />
                  </svg>
                )}

                {mon?.is_mega_capable && (
                  <img
                    src="/mega.png"
                    alt="Mega"
                    className="pointer-events-none absolute -left-2 -top-3 h-14 w-auto"
                  />
                )}

                {/* Delete checkbox — only on filled slots */}
                {mon && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleChecked(mon.id)}
                    aria-label={isChecked ? 'Deseleccionar' : 'Seleccionar para eliminar'}
                    className={`absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-md border-2 transition-colors ${
                      isChecked
                        ? 'border-red-500 bg-red-500/20 text-red-300'
                        : 'border-gray-600 bg-[#09090b] text-transparent hover:border-gray-400'
                    }`}
                  >
                    <Check className="h-5 w-5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer: Auto Skip + actions */}
        <div className="flex items-center justify-between gap-6 px-2">
          <div className="flex items-center gap-3">
            <span className="text-xl font-medium text-stone-300">Auto Skip</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoSkip}
              onClick={onToggleAutoSkip}
              className={`relative h-6 w-10 rounded-full p-[2px] transition-colors outline outline-[1.5px] ${
                autoSkip ? 'bg-neutral-900 outline-lime-700' : 'bg-neutral-900 outline-neutral-700'
              }`}
            >
              <span
                className={`block h-4 w-4 rounded-full transition-transform ${
                  autoSkip
                    ? 'translate-x-4 bg-lime-600 shadow-[0px_0px_7px_0px_rgba(48,110,25,0.5)]'
                    : 'translate-x-0 bg-neutral-600'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={busy || teamFull}
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-neutral-900 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-[#1c1c24] disabled:opacity-40"
            >
              <Gift className="h-4 w-4" /> Regalar Pokemon
            </button>
            <button
              type="button"
              disabled={busy || checked.size === 0}
              onClick={removeChecked}
              className="flex items-center gap-2 rounded-lg border border-red-900 bg-neutral-900 px-3.5 py-2.5 text-sm font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-40"
            >
              <Ban className="h-4 w-4" /> Eliminar Pokemon
            </button>
          </div>
        </div>
      </div>

      {/* Regalar — pick the pokemon to assign directly to this participant. */}
      <SearchModal
        open={searchOpen}
        wide
        onClose={() => setSearchOpen(false)}
        onSelect={gift}
      />
    </div>
  )
}
