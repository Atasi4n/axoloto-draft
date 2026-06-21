'use client'

import { useState } from 'react'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { SearchModal } from '@/features/auction/components/SearchModal'
import { assignPokemonAction } from '@/features/auction/actions/host.actions'
import { getSnapshotAction } from '@/features/auction/actions/snapshot.action'

export function GiftPokemonModal({
  eventId,
  open,
  onClose,
}: {
  eventId: string
  open: boolean
  onClose: () => void
}) {
  const participants = useAuctionStore((s) => s.participants)
  const setSnapshot = useAuctionStore((s) => s.setSnapshot)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  // Step 2: pick the pokemon for the chosen participant.
  if (participantId) {
    return (
      <SearchModal
        open
        wide
        onClose={() => setParticipantId(null)}
        onSelect={async (speciesId) => {
          if (busy) return
          setBusy(true)
          const r = await assignPokemonAction(eventId, speciesId, participantId)
          if (!r.success) {
            setBusy(false)
            alert(r.error)
            return
          }
          const snap = await getSnapshotAction(eventId)
          if (snap.success) setSnapshot(snap.data)
          setBusy(false)
          setParticipantId(null)
          onClose()
        }}
      />
    )
  }

  // Step 1: pick the participant.
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#0d0d12] p-6"
      >
        <h2 className="text-lg font-medium text-white">¿A quién le regalas un pokémon?</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[...participants]
            .sort((a, b) => a.display_name.localeCompare(b.display_name))
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setParticipantId(p.id)}
                className="rounded-lg border border-white/10 bg-[#15151c] px-4 py-3 text-left text-sm text-gray-200 transition-colors hover:bg-[#1c1c24]"
              >
                {p.display_name}
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
