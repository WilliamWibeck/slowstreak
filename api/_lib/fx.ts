import { admin } from './supabase-admin'
import { env } from './env'

/**
 * Conversion to SEK.
 *
 * Two paths, in priority order:
 *
 *   1. The bank already told us. Enable Banking fills in `exchange_rate` only
 *      when the bank itself converted — a foreign-currency card purchase, say —
 *      and then `instructed_amount` is the original sum. When the unit currency
 *      is SEK that is the exact figure that hit the statement, so it wins.
 *   2. Otherwise a daily reference rate. A NOK or EUR account's own
 *      transactions arrive with no SEK rate attached, because from the bank's
 *      point of view no conversion happened.
 *
 * Rates are cached per date so that re-running a day's sync produces the same
 * SEK figures it did the first time. That is what makes the job idempotent in
 * value, not just in row count.
 */

type RateRow = { currency: string; sek_per_unit: number }

/** ECB publishes nothing on weekends and holidays; Frankfurter serves the
 *  preceding business day and reports which date it actually used. We key the
 *  cache on the date we asked for, so lookups stay deterministic. */
type FrankfurterResponse = {
  date: string
  base: string
  rates: Record<string, number>
}

export class FxRateUnavailable extends Error {
  constructor(currency: string, date: string) {
    super(`No SEK rate available for ${currency} on ${date}`)
    this.name = 'FxRateUnavailable'
  }
}

/**
 * Rates for `currencies` on `date`, reading through the cache and fetching
 * only what is missing.
 *
 * One upstream call covers every currency: Frankfurter is EUR-based, so
 * SEK-per-NOK falls out of (SEK/EUR) ÷ (NOK/EUR).
 */
export async function ratesFor(
  date: string,
  currencies: string[],
): Promise<Map<string, number>> {
  const wanted = [...new Set(currencies)].filter((c) => c !== env.homeCurrency)
  const out = new Map<string, number>([[env.homeCurrency, 1]])
  if (wanted.length === 0) return out

  const { data: cached, error } = await admin
    .from('fx_rates')
    .select('currency, sek_per_unit')
    .eq('rate_date', date)
    .in('currency', wanted)
  if (error) throw new Error(`fx cache read failed: ${error.message}`)

  for (const row of (cached ?? []) as RateRow[]) {
    out.set(row.currency, Number(row.sek_per_unit))
  }

  const missing = wanted.filter((c) => !out.has(c))
  if (missing.length === 0) return out

  const fetched = await fetchRates(date, missing)
  const rows = missing
    .filter((c) => fetched.rates.has(c))
    .map((c) => ({
      rate_date: date,
      currency: c,
      sek_per_unit: fetched.rates.get(c)!,
      effective_date: fetched.effectiveDate,
      source: 'frankfurter',
    }))

  if (rows.length > 0) {
    // Ignore conflicts rather than overwrite: a rate already cached for this
    // date is the one earlier rows were converted at, and changing it now
    // would silently re-price transactions that are already stored.
    const { error: writeError } = await admin.from('fx_rates').upsert(rows, {
      onConflict: 'rate_date,currency',
      ignoreDuplicates: true,
    })
    if (writeError)
      throw new Error(`fx cache write failed: ${writeError.message}`)
    for (const r of rows) out.set(r.currency, r.sek_per_unit)
  }

  for (const c of wanted) {
    if (!out.has(c)) throw new FxRateUnavailable(c, date)
  }
  return out
}

async function fetchRates(
  date: string,
  currencies: string[],
): Promise<{ rates: Map<string, number>; effectiveDate: string }> {
  const symbols = [...new Set([...currencies, env.homeCurrency])].join(',')
  const url = `${env.fxBaseUrl}/${date}?base=EUR&symbols=${symbols}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`FX lookup failed (${res.status}) for ${date}: ${url}`)
  }
  const body = (await res.json()) as FrankfurterResponse

  const sekPerEur = body.rates?.[env.homeCurrency]
  if (!sekPerEur) {
    throw new Error(
      `FX response for ${date} carried no ${env.homeCurrency} rate`,
    )
  }

  const rates = new Map<string, number>()
  for (const c of currencies) {
    if (c === 'EUR') {
      rates.set(c, sekPerEur)
      continue
    }
    const perEur = body.rates?.[c]
    // Cross-rate via EUR. Undefined means the source doesn't quote it at all,
    // which the caller turns into FxRateUnavailable rather than a silent zero.
    if (perEur) rates.set(c, sekPerEur / perEur)
  }
  return { rates, effectiveDate: body.date ?? date }
}

export type Converted = {
  amountSek: number
  source: 'native' | 'bank' | 'daily'
}

/**
 * Convert one transaction amount, preferring the bank's own rate.
 *
 * `bankInstructed` is `exchange_rate.instructed_amount`: the original sum
 * before the bank converted it. It is usable exactly when that original side
 * was already SEK — a card purchase made in Sweden on the Bank Norwegian
 * account, say, which books in NOK but was charged in SEK. Then the instructed
 * amount is the figure that actually left the account in SEK terms, and no
 * reference rate can beat it.
 *
 * The sibling `exchange_rate.exchange_rate` field is deliberately ignored: the
 * direction of the quote is not pinned down by the schema, and guessing wrong
 * misprices by the square of the rate rather than failing loudly.
 */
export function convert(input: {
  amount: number
  currency: string
  bankInstructed?: { currency: string; amount: number }
  dailyRates: Map<string, number>
}): Converted {
  if (input.currency === env.homeCurrency) {
    return { amountSek: round2(input.amount), source: 'native' }
  }

  const instructed = input.bankInstructed
  if (instructed && instructed.currency === env.homeCurrency) {
    return { amountSek: round2(instructed.amount), source: 'bank' }
  }

  const rate = input.dailyRates.get(input.currency)
  if (!rate) throw new FxRateUnavailable(input.currency, 'requested date')
  return { amountSek: round2(input.amount * rate), source: 'daily' }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
