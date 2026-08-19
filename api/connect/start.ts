import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BANKS, bankBySlug } from '../_lib/banks.js'
import { startAuthorization } from '../_lib/enablebanking.js'
import { secretMatches, signState } from '../_lib/state.js'

/** PSD2 caps account-information consent at 90 days. Banks may grant less;
 *  whatever comes back on the session is what gets stored. */
const CONSENT_DAYS = 90

/**
 * Step one of the one-time bank consent — run once per account, by hand.
 *
 *   open "https://slowstreak.com/api/connect/start?bank=seb&token=$CRON_SECRET"
 *
 * Redirects to the bank for BankID. The bank then calls /api/connect/callback,
 * which is where the session actually gets stored.
 *
 * The token guards against a stranger burning API quota; the signed `state`
 * carried through the redirect is what guards the callback itself.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token =
    typeof req.query.token === 'string' ? req.query.token : undefined
  if (!secretMatches(token)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const slug = typeof req.query.bank === 'string' ? req.query.bank : ''
  const bank = bankBySlug(slug)
  if (!bank) {
    return res.status(400).json({
      error: `unknown bank "${slug}"`,
      known: BANKS.map((b) => b.slug),
    })
  }

  try {
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + CONSENT_DAYS)

    const auth = await startAuthorization({
      aspspName: bank.aspspName,
      aspspCountry: bank.aspspCountry,
      state: signState(bank.slug),
      validUntil,
    })

    return res.redirect(302, auth.url)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[connect/start] failed:', message)
    return res.status(502).json({ error: message })
  }
}
