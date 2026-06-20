'use client'

import { useState } from 'react'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { startEventAction } from '@/features/auction/actions/host.actions'
import { getSnapshotAction } from '@/features/auction/actions/snapshot.action'
import { HostTopBar } from './HostTopBar'

function Dot({ online }: { online: boolean }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: online ? '#4ade80' : '#3f3f46' }}
    />
  )
}

export function HostWaitingRoom({
  eventId,
  online,
}: {
  eventId: string
  online: Set<string>
}) {
  const participants = useAuctionStore((s) => s.participants)
  const setSnapshot = useAuctionStore((s) => s.setSnapshot)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pairsConnected = participants.filter(
    (p) => online.has(p.user_id) && p.coach != null && online.has(p.coach.user_id),
  ).length

  async function handleStart() {
    setStarting(true)
    setError(null)
    const result = await startEventAction(eventId)
    if (!result.success) {
      setError(result.error)
      setStarting(false)
      return
    }
    // Refetch so the host swaps to the control panel immediately; participants
    // get the change via realtime.
    const snap = await getSnapshotAction(eventId)
    if (snap.success) setSnapshot(snap.data)
  }

  return (
    <main className="relative flex flex-1 items-center justify-center bg-[#09090b] p-10">
      <div className="absolute right-6 top-5">
        <HostTopBar />
      </div>
      <div className="w-full max-w-5xl rounded-xl border border-white/5 bg-white/[0.02] p-8">
        <h1 className="mb-6 text-2xl font-medium text-white">Sala de espera</h1>

        <div className="grid grid-cols-4 gap-3">
          {participants.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-white/5 bg-[#141419] px-3 py-3"
            >
              <div className="flex items-center gap-2">
                <Dot online={online.has(p.user_id)} />
                <span className="text-sm font-medium text-white">{p.display_name}</span>
                <span className="text-xs text-gray-600">· invalido</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Dot online={!!p.coach && online.has(p.coach.user_id)} />
                <span className="text-sm text-gray-400">
                  {p.coach?.display_name ?? '—'}
                </span>
                <span className="text-xs text-gray-600">· coach</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {pairsConnected} de {participants.length} parejas conectadas
          </span>
          <div className="flex items-center gap-4">
            {error && <span className="text-sm text-red-400">{error}</span>}
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="rounded-lg bg-[#0F1D0E] px-7 py-2.5 text-sm font-medium text-[#d9f99d] shadow-[0px_0px_29px_0px_rgba(48,110,25,0.25)] outline outline-2 -outline-offset-2 outline-[#3f6212] transition-all hover:bg-[#13241a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting ? 'Empezando…' : 'Empezar Evento'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
