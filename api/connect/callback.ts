import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bankBySlug } from '../_lib/banks'
import { createSession, type SessionAccount } from '../_lib/enablebanking'
import { env } from '../_lib/env'
import { verifyState } from '../_lib/state'
import { admin } from '../_lib/supabase-admin'

/**
 * Step two of the consent: the bank redirects here with a one-time `code`.
 *
 * This endpoint is necessarily public — the bank has to be able to reach it —
 * so the signed `state` is what establishes that the redirect belongs to a flow
 * we started. The resulting session id is written straight to Postgres and
 * never rendered into the page.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''

  if (!code) return html(res, 400, 'No authorisation code in the redirect.')

  const verified = verifyState(state)
  if (!verified) {
    return html(res, 400, 'That link is expired or was not issued by this app.')
  }

  const bank = bankBySlug(verified.slug)
  if (!bank) return html(res, 400, `Unknown bank "${verified.slug}".`)

  try {
    const session = await createSession(code)
    const account = pickAccount(session.accounts, bank.slug)
    if (!account) {
      return html(res, 502, 'The bank returned no accounts for this consent.')
    }

    const { error } = await admin.from('bank_connections').upsert(
      {
        user_id: env.userId,
        account: bank.slug,
        display_name: bank.label,
        aspsp_name: bank.aspspName,
        aspsp_country: bank.aspspCountry,
        session_id: session.session_id,
        account_uid: account.uid,
        currency: account.currency || 'SEK',
        consent_expires_at: session.access?.valid_until ?? null,
        needs_reconnect: false,
        last_error: '',
      },
      { onConflict: 'user_id,account' },
    )
    if (error) throw new Error(error.message)

    return html(
      res,
      200,
      `${bank.label} connected. Consent runs until ` +
        `${session.access?.valid_until?.slice(0, 10) ?? 'an unstated date'}. ` +
        'The nightly sync will pick it up; you can close this tab.',
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[connect/callback] failed:', message)
    return html(res, 502, `Could not complete the connection: ${message}`)
  }
}

/**
 * Restricted Production consents usually carry exactly one account. Where a
 * bank returns several, the first is taken and logged — connecting a second
 * account from the same bank means giving it its own slug in banks.ts.
 */
function pickAccount(
  accounts: SessionAccount[] | undefined,
  slug: string,
): SessionAccount | undefined {
  const list = accounts ?? []
  if (list.length > 1) {
    console.warn(
      `[connect/callback] ${slug} returned ${list.length} accounts; using the first`,
    )
  }
  return list[0]
}

function html(res: VercelResponse, status: number, message: string) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(status).send(
    `<!doctype html><meta charset="utf-8">
     <title>Slowstreak — bank connection</title>
     <body style="font:15px/1.6 system-ui,sans-serif;background:#161826;color:#e9e9ed;padding:48px">
       <p style="max-width:46ch">${escapeHtml(message)}</p>
     </body>`,
  )
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] as string,
  )
}
