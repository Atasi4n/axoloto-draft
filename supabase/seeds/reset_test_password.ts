/**
 * Dev helper: resets every account's password IN PLACE (no delete/recreate, so
 * all pairings/teams/event data stay intact) using the service-role admin API,
 * which can set a password without knowing the old one.
 *
 * Password scheme:
 *   PARTICIPANT → `${name}Invalido`
 *   COACH       → `${name}Coach`
 *   HOST        → `Hostinger`
 *
 * Also renames Cri → Chris (auth email + users.username + participants.display_name).
 *
 * Requires in apps/draft/.env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run from the repo root:  pnpm reset:pw
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

const HOST_PASSWORD = 'Hostinger'
// old username -> new username
const RENAMES: Record<string, string> = { Cri: 'Chris' }

function passwordFor(name: string, role: string): string {
  if (role === 'HOST') return HOST_PASSWORD
  if (role === 'COACH') return `${name}Coach`
  return `${name}Invalido` // PARTICIPANT
}

async function main() {
  const { data: users, error } = await admin
    .from('users')
    .select('id, username, role')
  if (error) throw error
  if (!users || users.length === 0) {
    console.error('❌ No se encontraron usuarios.')
    process.exit(1)
  }

  const done: { username: string; password: string; role: string }[] = []

  for (const u of users) {
    const id = u.id as string
    const role = u.role as string
    const oldName = u.username as string
    const newName = RENAMES[oldName] ?? oldName
    const password = passwordFor(newName, role)

    // Auth update: password (+ new email if renamed).
    const authUpdate: { password: string; email_confirm: boolean; email?: string } = {
      password,
      email_confirm: true,
    }
    if (RENAMES[oldName]) {
      authUpdate.email = `${newName.toLowerCase()}@paralimpico.local`
    }

    const { error: aErr } = await admin.auth.admin.updateUserById(id, authUpdate)
    if (aErr) {
      console.log(`❌ ${oldName}: ${aErr.message}`)
      continue
    }

    // Rename DB rows if needed.
    if (RENAMES[oldName]) {
      await admin.from('users').update({ username: newName }).eq('id', id)
      await admin.from('participants').update({ display_name: newName }).eq('user_id', id)
    }

    done.push({ username: newName, password, role })
  }

  // Print grouped credential list.
  const byRole = (r: string) => done.filter((d) => d.role === r).sort((a, b) => a.username.localeCompare(b.username))
  const line = (d: { username: string; password: string }) => `   ${d.username.padEnd(12)} ${d.password}`

  console.log('\n✅ Contraseñas reseteadas:\n')
  console.log(' HOST');        byRole('HOST').forEach((d) => console.log(line(d)))
  console.log('\n PARTICIPANTES'); byRole('PARTICIPANT').forEach((d) => console.log(line(d)))
  console.log('\n COACHES');     byRole('COACH').forEach((d) => console.log(line(d)))
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e.message ?? e)
    process.exit(1)
  })
