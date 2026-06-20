'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { getSnapshotAction } from '@/features/auction/actions/snapshot.action'

// Realtime is used purely as a "something changed" signal: on any change we
// refetch the full snapshot through the (authenticated, RLS-respecting) server
// action. We never trust the realtime payload contents — under RLS those can
// arrive empty for a browser client, which previously nulled the store and
// flashed the loading screen.
export function useAuctionRealtime(eventId: string) {
  const setSnapshot = useAuctionStore((s) => s.setSnapshot)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true

    async function refetch() {
      const result = await getSnapshotAction(eventId)
      if (active && result.success) setSnapshot(result.data)
    }

    // Hydrate immediately.
    refetch()

    // Debounce bursts of changes into a single refetch.
    function schedule() {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(refetch, 150)
    }

    const tables = [
      'auction_state',
      'auction_pokemon',
      'bids',
      'participants',
      'team_pokemon',
    ] as const

    let channel = supabase.channel(`auction-${eventId}`)
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        schedule,
      )
    }
    channel.subscribe()

    return () => {
      active = false
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [eventId, setSnapshot])
}
