'use client'

import { useSearchParams } from 'next/navigation'
import { useAuctionRealtime } from '@/features/auction/realtime/useAuctionRealtime'
import { usePresence } from '@/features/auction/realtime/usePresence'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { WaitingRoom, type WaitingVariant } from './WaitingRoom'
import { InEventScreen } from './InEventScreen'
import { CoachInEventScreen } from './CoachInEventScreen'
import { LogoutButton } from '@/features/auth/components/LogoutButton'
import { User } from 'lucide-react'
import type { UserRole } from '@/types/auction.types'

type Props = {
  eventId:           string
  userId:            string
  role:              UserRole
  displayName:       string | null
  counterpartUserId: string | null
}

const ROLE_LABEL: Record<UserRole, string> = {
  HOST:        'Host',
  PARTICIPANT: 'Invalido',
  COACH:       'Coach',
}

// Top-left "who am I" tag so participants/coaches always see whose screen this is.
function WhoAmI({ name, role }: { name: string | null; role: UserRole }) {
  return (
    <div className="absolute left-3 top-3 z-10 flex max-w-[55vw] items-center gap-2 rounded-full border border-white/10 bg-[#15151c] px-3 py-1.5">
      <User className="h-4 w-4 shrink-0 text-gray-400" />
      <span className="truncate text-sm font-medium text-white">{name ?? '—'}</span>
      <span className="shrink-0 text-xs text-gray-500">· {ROLE_LABEL[role]}</span>
    </div>
  )
}

function Shell({
  children,
  displayName,
  role,
}: {
  children: React.ReactNode
  displayName: string | null
  role: UserRole
}) {
  return (
    <div className="relative flex flex-1 flex-col">
      <WhoAmI name={displayName} role={role} />
      {children}
      <div className="absolute right-3 top-3 z-10">
        <LogoutButton />
      </div>
    </div>
  )
}

export function MobileApp({ eventId, userId, role, displayName, counterpartUserId }: Props) {
  const { error } = useAuctionRealtime(eventId)
  const online = usePresence(eventId, userId)
  const phase = useAuctionStore((s) => s.state?.phase ?? null)

  // DEV: /auction?dev=event renders the in-event screen without starting the event.
  const devEvent = useSearchParams().get('dev') === 'event'

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

  const inEventPhase = phase === 'MEGA' || phase === 'MAIN' || phase === 'SPECIAL'

  if (devEvent || inEventPhase) {
    if (role === 'COACH') {
      return (
        <Shell displayName={displayName} role={role}>
          <CoachInEventScreen counterpartUserId={counterpartUserId} eventId={eventId} />
        </Shell>
      )
    }
    return (
      <Shell displayName={displayName} role={role}>
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
      <Shell displayName={displayName} role={role}>
        <WaitingRoom variant={variant} />
      </Shell>
    )
  }

  // ENDED
  return (
    <Shell displayName={displayName} role={role}>
      <main className="flex flex-1 items-center justify-center bg-[#09090b]">
        <p className="text-sm text-gray-400">evento finalizado · pendiente</p>
      </main>
    </Shell>
  )
}
