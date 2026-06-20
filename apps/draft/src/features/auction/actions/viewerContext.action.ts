'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/auction.types'

export type ViewerContext = {
  eventId:           string
  userId:            string
  role:              UserRole
  // The paired counterpart's user_id: the coach (if viewer is a participant)
  // or the managed participant (if viewer is a coach). Null if unpaired.
  counterpartUserId: string | null
}

type Result =
  | { success: true;  data: ViewerContext }
  | { success: false; error: string }

// Resolves who the logged-in user is and who their pair is, for the mobile UI.
export async function getViewerContextAction(): Promise<Result> {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = userRow?.role as UserRole | undefined
  if (!role) return { success: false, error: 'No role found.' }

  let eventId: string | null = null
  let counterpartUserId: string | null = null

  if (role === 'PARTICIPANT') {
    const { data: participant } = await supabase
      .from('participants')
      .select('id, event_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (participant) {
      eventId = participant.event_id
      const { data: cp } = await supabase
        .from('coach_participants')
        .select('coach_id')
        .eq('participant_id', participant.id)
        .maybeSingle()

      if (cp) {
        const { data: coach } = await supabase
          .from('coaches')
          .select('user_id')
          .eq('id', cp.coach_id)
          .maybeSingle()
        counterpartUserId = coach?.user_id ?? null
      }
    }
  } else if (role === 'COACH') {
    const { data: coach } = await supabase
      .from('coaches')
      .select('id, event_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (coach) {
      eventId = coach.event_id
      const { data: cp } = await supabase
        .from('coach_participants')
        .select('participant_id')
        .eq('coach_id', coach.id)
        .maybeSingle()

      if (cp) {
        const { data: participant } = await supabase
          .from('participants')
          .select('user_id')
          .eq('id', cp.participant_id)
          .maybeSingle()
        counterpartUserId = participant?.user_id ?? null
      }
    }
  }

  // Fallback (e.g. a role with no event-scoped row): the single non-archived event.
  if (!eventId) {
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .neq('status', 'ARCHIVED')
      .order('created_at', { ascending: true })
      .limit(1)
    eventId = events?.[0]?.id ?? null
  }

  if (!eventId) return { success: false, error: 'No event found.' }

  return {
    success: true,
    data: { eventId, userId: user.id, role, counterpartUserId },
  }
}
