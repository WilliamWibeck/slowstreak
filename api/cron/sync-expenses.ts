import type { VercelRequest, VercelResponse } from '@vercel/node'
import { env } from '../_lib/env.js'
import { secretMatches } from '../_lib/state.js'
import { runSync } from '../_lib/sync.js'

/**
 * Daily transaction import. Scheduled from vercel.json.
 *
 * Safe to hit by hand at any time — the sync converges rather than accumulates:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://slowstreak.com/api/cron/sync-expenses
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron sends CRON_SECRET as a bearer token. The same header works for
  // a manual run, so there is one code path and no second secret to leak.
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!secretMatches(bearer)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    const report = await runSync(env.userId)
    const failed = report.accounts.filter((a) => a.error)
    // 207 when some accounts came through and others didn't, so a failing bank
    // is visible in Vercel's log filters without masking the ones that worked.
    return res.status(failed.length === 0 ? 200 : 207).json(report)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[sync-expenses] failed:', message)
    return res.status(500).json({ error: message })
  }
}
