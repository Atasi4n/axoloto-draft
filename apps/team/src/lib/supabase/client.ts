import { createBrowserSupabaseClient } from "@axoloto/supabase";

// Anon, read-only browser client. The team app never authenticates and never
// writes to the database — it only reads the shared Pokémon reference tables.
export const supabase = createBrowserSupabaseClient();
