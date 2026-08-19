import { createSign } from 'node:crypto'
import { env } from './env.js'

/**
 * Enable Banking client.
 *
 * Every request is authorised with a short-lived RS256 JWT signed with the
 * private key generated when the application was registered in the Control
 * Panel. That key can never reach the browser, which is why this whole flow
 * lives in a serverless function rather than in the SPA.
 *
 * Written against https://enablebanking.com/docs/api/reference/. The request
 * shapes below are the documented ones; if a bank surprises us the fix should
 * be local to this file.
 */

// ── auth ─────────────────────────────────────────────────────────────────

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Hand-rolled rather than pulling in a JWT library: it is one signature over
 * two base64url segments, and this avoids a dependency that would otherwise
 * exist only for the sync job.
 */
function signJwt(): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(
    JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: env.ebApplicationId }),
  )
  const payload = base64url(
    JSON.stringify({
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat: now,
      // Short window; a new token is minted per run rather than cached.
      exp: now + 3600,
    }),
  )
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(env.ebPrivateKey)
  return `${header}.${payload}.${base64url(signature)}`
}

async function call<T>(
  path: string,
  init: {
    method?: string
    body?: unknown
    query?: Record<string, string>
  } = {},
): Promise<T> {
  const url = new URL(env.ebBaseUrl + path)
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v)
  }

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${signJwt()}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new EnableBankingError(res.status, path, text)
  }
  return text ? (JSON.parse(text) as T) : ({} as T)
}

export class EnableBankingError extends Error {
  status: number
  path: string

  constructor(status: number, path: string, body: string) {
    super(`Enable Banking ${status} on ${path}: ${body.slice(0, 400)}`)
    this.name = 'EnableBankingError'
    this.status = status
    this.path = path
  }

  /**
   * 401 and 403 on an account endpoint mean the PSU consent has lapsed or been
   * withdrawn — the reconnect flow is the only fix, so the caller flags the
   * connection rather than retrying.
   */
  get isConsentProblem(): boolean {
    return this.status === 401 || this.status === 403
  }
}

// ── consent flow ─────────────────────────────────────────────────────────

export type AuthStartResult = {
  url: string
  authorization_id: string
}

/**
 * Step one of the one-time consent: ask Enable Banking for the bank's
 * authorisation URL, which the browser is then redirected to for BankID.
 *
 * `validUntil` is the requested consent lifetime. PSD2 caps this at roughly 90
 * days, and banks are free to grant less, so the value that comes back on the
 * session is the one worth storing.
 */
export function startAuthorization(input: {
  aspspName: string
  aspspCountry: string
  state: string
  validUntil: Date
}): Promise<AuthStartResult> {
  return call<AuthStartResult>('/auth', {
    method: 'POST',
    body: {
      access: { valid_until: input.validUntil.toISOString() },
      aspsp: { name: input.aspspName, country: input.aspspCountry },
      state: input.state,
      redirect_url: env.ebRedirectUrl,
      psu_type: 'personal',
    },
  })
}

export type SessionAccount = {
  uid: string
  identification_hash?: string
  currency?: string
  account_id?: { iban?: string; other?: { identification?: string } }
  name?: string
  product?: string
}

export type SessionResult = {
  session_id: string
  accounts: SessionAccount[]
  access?: { valid_until?: string }
  aspsp?: { name?: string; country?: string }
}

/** Step two: exchange the `code` from the redirect for a durable session. */
export function createSession(code: string): Promise<SessionResult> {
  return call<SessionResult>('/sessions', { method: 'POST', body: { code } })
}

// ── transactions ─────────────────────────────────────────────────────────

export type Amount = { currency: string; amount: string }

export type EbTransaction = {
  /** Unique within the statement — but see the caveat in sync.ts. */
  entry_reference?: string
  transaction_amount: Amount
  credit_debit_indicator?: 'CRDT' | 'DBIT'
  /** 'BOOK' settled, 'PDNG' pending, 'RJCT' / 'CANC' discarded. */
  status?: string
  booking_date?: string
  value_date?: string
  transaction_date?: string
  creditor?: { name?: string }
  debtor?: { name?: string }
  creditor_account?: { iban?: string }
  debtor_account?: { iban?: string }
  remittance_information?: string[]
  merchant_category_code?: string
  /** Present only when the bank itself performed a conversion. */
  exchange_rate?: {
    unit_currency?: string
    exchange_rate?: string
    rate_type?: string
    instructed_amount?: Amount
  }
}

export type TransactionsPage = {
  transactions: EbTransaction[]
  continuation_key?: string | null
}

/**
 * One page of transactions. The caller drives the loop with continuation_key
 * so we never refetch full history — see fetchTransactionsSince.
 */
export function getTransactionsPage(input: {
  accountUid: string
  dateFrom?: string
  continuationKey?: string
}): Promise<TransactionsPage> {
  return call<TransactionsPage>(`/accounts/${input.accountUid}/transactions`, {
    query: {
      // Omitted once we are paging: the continuation key already encodes it.
      ...(input.continuationKey
        ? { continuation_key: input.continuationKey }
        : { date_from: input.dateFrom ?? '' }),
    },
  })
}

/**
 * Every transaction booked on or after `dateFrom`, following continuation keys
 * to the end.
 *
 * The page cap is a guard against a malformed continuation key spinning
 * forever, not an expected limit — a daily delta is a page or two.
 */
export async function fetchTransactionsSince(input: {
  accountUid: string
  dateFrom: string
  maxPages?: number
}): Promise<EbTransaction[]> {
  const out: EbTransaction[] = []
  let continuationKey: string | undefined
  const maxPages = input.maxPages ?? 50

  for (let page = 0; page < maxPages; page++) {
    const res = await getTransactionsPage({
      accountUid: input.accountUid,
      dateFrom: input.dateFrom,
      continuationKey,
    })
    out.push(...(res.transactions ?? []))
    if (!res.continuation_key) return out
    continuationKey = res.continuation_key
  }

  throw new Error(
    `Transaction paging for ${input.accountUid} exceeded ${maxPages} pages — ` +
      'refusing to loop. Check the continuation key handling.',
  )
}
