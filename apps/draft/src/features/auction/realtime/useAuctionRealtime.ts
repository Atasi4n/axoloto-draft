'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuctionStore } from '@/features/auction/hooks/useAuctionStore'
import { getSnapshotAction } from '@/features/auction/actions/snapshot.action'

const MAX_RETRIES = 4
const RETRY_DELAY_MS = 2000

// Realtime is used purely as a "something changed" signal: on any change we
// refetch the full snapshot through the (authenticated, RLS-respecting) server
// action. We never trust the realtime payload contents — under RLS those can
// arrive empty for a browser client, which previously nulled the store and
// flashed the loading screen.
export function useAuctionRealtime(eventId: string) {
  const setSnapshot = useAuctionStore((s) => s.setSnapshot)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function refetch(attempt = 0) {
      try {
        const result = await getSnapshotAction(eventId)
        if (!active) return
        if (result.success) {
          setError(null)
          setSnapshot(result.data)
        } else {
          console.error('[useAuctionRealtime] snapshot failed:', result.error)
          if (attempt < MAX_RETRIES) {
            timer.current = setTimeout(() => refetch(attempt + 1), RETRY_DELAY_MS)
          } else {
            setError(result.error)
          }
        }
      } catch (err) {
        if (!active) return
        console.error('[useAuctionRealtime] snapshot threw:', err)
        if (attempt < MAX_RETRIES) {
          timer.current = setTimeout(() => refetch(attempt + 1), RETRY_DELAY_MS)
        } else {
          setError(err instanceof Error ? err.message : 'Error desconocido')
        }
      }
    }

    // Hydrate immediately.
    refetch()

    // Debounce bursts of changes into a single refetch.
    function schedule() {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => refetch(), 150)
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

  return { error }
}
