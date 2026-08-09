import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loudly at startup rather than with an opaque network error later.
if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase config. Copy .env.local.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your project dashboard ' +
      '(Project Settings → API), then restart the dev server.',
  )
}

// The anon key is meant to ship in the browser bundle — row level security is
// what actually protects the data, not the secrecy of this key.
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
