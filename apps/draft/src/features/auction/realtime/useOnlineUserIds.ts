'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

// Read-only presence: observes who is online on the event's presence channel
// WITHOUT registering itself (it never calls track()). Used by the public
// /stream display to tell which participants are currently connected.
// presenceState() keys are the presence keys = user ids (set by usePresence).
export function useOnlineUserIds(eventId: string | null): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!eventId) return

    const channel = supabase.channel(`presence-${eventId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId])

  return online
}
