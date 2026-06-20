import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

// Cookie-aware browser client: shares the auth session set server-side, so
// realtime subscriptions + client queries run AS the logged-in user (RLS sees
// them). A plain createClient() would be anonymous → realtime payloads come
// back empty under RLS.
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
