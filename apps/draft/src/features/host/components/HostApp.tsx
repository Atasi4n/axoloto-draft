'use client'

import { useSearchParams } from 'next/navigation'
import { useAuctionRealtime } from '@/features/auction/realtime/useAuctionRealtime'
import { usePresence } from '@/features/auction/realtime/usePresence'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { HostWaitingRoom } from './HostWaitingRoom'
import { HostControlPanel } from './HostControlPanel'

export function HostApp({ eventId, userId }: { eventId: string; userId: string }) {
  const { error } = useAuctionRealtime(eventId)
  const online = usePresence(eventId, userId)
  const phase = useAuctionStore((s) => s.state?.phase ?? null)

  // DEV: /host?dev=event previews the control panel without starting the event.
  const devEvent = useSearchParams().get('dev') === 'event'
  const showControl = devEvent || (phase != null && phase !== 'WAITING')

  if (phase === null && !devEvent) {
    return (
      <main className="flex flex-1 items-center justify-center bg-[#09090b]">
        {error ? (
          <p className="text-sm text-red-400">Error al cargar: {error}</p>
        ) : (
          <p className="text-sm text-gray-500">Cargando…</p>
        )}
      </main>
    )
  }

  return showControl ? (
    <HostControlPanel eventId={eventId} />
  ) : (
    <HostWaitingRoom eventId={eventId} online={online} />
  )
}
