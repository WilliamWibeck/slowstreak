import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

/**
 * Service-role client for the sync job.
 *
 * This key bypasses row level security entirely, which is exactly what an
 * unattended importer needs — there is no logged-in session to authorise
 * against. Every write therefore has to set user_id explicitly; RLS is not
 * going to do it for us.
 *
 * Deliberately untyped against Database: the generated types describe the
 * frontend's view of the schema, and the tables this job writes to are ones
 * the browser mostly does not touch.
 */
export const admin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
