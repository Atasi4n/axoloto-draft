'use client'

import { useSearchParams } from 'next/navigation'
import { useAuctionRealtime } from '@/features/auction/realtime/useAuctionRealtime'
import { usePresence } from '@/features/auction/realtime/usePresence'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { WaitingRoom, type WaitingVariant } from './WaitingRoom'
import { InEventScreen } from './InEventScreen'
import { CoachInEventScreen } from './CoachInEventScreen'
import { LogoutButton } from '@/features/auth/components/LogoutButton'
import type { UserRole } from '@/types/auction.types'

type Props = {
  eventId:           string
  userId:            string
  role:              UserRole
  counterpartUserId: string | null
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col">
      {children}
      <div className="absolute right-3 top-3 z-10">
        <LogoutButton />
      </div>
    </div>
  )
}

export function MobileApp({ eventId, userId, role, counterpartUserId }: Props) {
  useAuctionRealtime(eventId)
  const online = usePresence(eventId, userId)
  const phase = useAuctionStore((s) => s.state?.phase ?? null)

  // DEV: /mobile?dev=event renders the in-event screen without starting the event.
  const devEvent = useSearchParams().get('dev') === 'event'

  if (phase === null && !devEvent) {
    return (
      <main className="flex flex-1 items-center justify-center bg-[#09090b]">
        <p className="text-sm text-gray-500">Cargando…</p>
      </main>
    )
  }

  const inEventPhase = phase === 'MEGA' || phase === 'MAIN' || phase === 'SPECIAL'

  if (devEvent || inEventPhase) {
    if (role === 'COACH') {
      return (
        <Shell>
          <CoachInEventScreen counterpartUserId={counterpartUserId} eventId={eventId} />
        </Shell>
      )
    }
    return (
      <Shell>
        <InEventScreen userId={userId} eventId={eventId} dev={devEvent} />
      </Shell>
    )
  }

  if (phase === 'WAITING') {
    const counterpartOnline = counterpartUserId
      ? online.has(counterpartUserId)
      : true
    const variant: WaitingVariant = counterpartOnline
      ? 'host'
      : role === 'COACH'
        ? 'participant-missing'
        : 'coach-missing'

    return (
      <Shell>
        <WaitingRoom variant={variant} />
      </Shell>
    )
  }

  // ENDED
  return (
    <Shell>
      <main className="flex flex-1 items-center justify-center bg-[#09090b]">
        <p className="text-sm text-gray-400">evento finalizado · pendiente</p>
      </main>
    </Shell>
  )
}
