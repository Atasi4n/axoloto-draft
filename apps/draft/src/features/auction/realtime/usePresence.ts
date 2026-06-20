'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

// Joins a Supabase Realtime Presence channel for the event, registers the
// current user as online, and returns the set of currently-online user ids.
// Purely client-side — no DB writes (connection_status is never touched).
export function usePresence(eventId: string, userId: string): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set())

  useEffect(() => {
    const channel = supabase.channel(`presence-${eventId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        // presenceState() keys are the presence keys = user ids.
        setOnline(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ userId, at: Date.now() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, userId])

  return online
}
