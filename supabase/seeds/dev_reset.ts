/**
 * Dev helper: resets the event back to its pre-start (WAITING) state so the
 * waiting room / start flow can be tested repeatedly. Clears the draft data and
 * restores budgets. Uses the service-role key (bypasses RLS).
 *
 *   pnpm dev:reset
 */
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../apps/draft/.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../../apps/draft/.env') })

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en apps/draft/.env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: events } = await admin
    .from('events')
    .select('id, slug')
    .neq('status', 'ARCHIVED')
    .order('created_at', { ascending: true })
    .limit(1)

  const event = events?.[0]
  if (!event) {
    console.error('❌ No se encontró un evento.')
    process.exit(1)
  }
  const eventId = event.id

  console.log(`\n🔄 Reseteando evento "${event.slug}" a WAITING\n`)

  // Clear auction_state FK refs FIRST (current_turn_id → auction_turns,
  // current_auction_pokemon_id → auction_pokemon) or the deletes below fail the
  // FK constraint and leave orphan rows.
  await admin
    .from('auction_state')
    .update({
      phase: 'WAITING',
      status: 'IDLE',
      current_turn_id: null,
      current_auction_pokemon_id: null,
      timer_ends_at: null,
      host_override_active: false,
    })
    .eq('event_id', eventId)

  await admin.from('bids').delete().eq('event_id', eventId)
  await admin.from('team_pokemon').delete().eq('event_id', eventId)
  await admin.from('auction_pokemon').delete().eq('event_id', eventId)
  await admin.from('auction_turns').delete().eq('event_id', eventId)

  await admin
    .from('participants')
    .update({ budget: 1000, has_mega: false, special_session_won: false })
    .eq('event_id', eventId)

  console.log('✅ Listo — el evento está en WAITING otra vez.\n')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e.message ?? e)
    process.exit(1)
  })
