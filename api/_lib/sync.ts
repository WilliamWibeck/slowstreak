import { admin } from './supabase-admin.js'
import { env } from './env.js'
import {
  EnableBankingError,
  fetchTransactionsSince,
  type EbTransaction,
} from './enablebanking.js'
import { convert, ratesFor } from './fx.js'
import { buildCategorizer } from './categorize.js'
import { merchantKey, merchantRaw } from './merchant.js'
import { TRANSFER } from '../../src/data/categories.js'

/**
 * The daily import.
 *
 * Idempotent by construction — running it twice, or ten times, converges on the
 * same rows with the same values:
 *
 *   • Rows are upserted on (user_id, account, bank_transaction_id), never
 *     inserted blind, so a re-run updates in place.
 *   • FX rates are cached per date, so a re-run converts identically.
 *   • A settled transaction is reconciled onto its pending row before the
 *     upsert, so a bank that changes the reference on booking does not leave
 *     the amount counted twice.
 *   • Hand-corrected categories are pinned and survive re-import.
 */

/** How far back each run re-reads. Pending rows settle days later and banks
 *  backdate, so the window has to overlap what we already have; the upsert is
 *  what makes the overlap free. */
const LOOKBACK_DAYS = 10

/** First run on a fresh connection, with no watermark to work from. */
const INITIAL_BACKFILL_DAYS = 90

/** A settling transaction can drift from its pending twin — a tip, an FX
 *  adjustment, a fuel pre-auth. Wider than a rounding error, tighter than two
 *  genuinely different purchases at the same shop. */
const RECONCILE_AMOUNT_TOLERANCE = 0.15
const RECONCILE_MIN_TOLERANCE_SEK = 20
const RECONCILE_DAY_WINDOW = 6

/** Same-day equal-and-opposite amounts across two of your own accounts. */
const TRANSFER_DAY_WINDOW = 1
const TRANSFER_AMOUNT_EPSILON = 0.5

/** PostgREST `in` lists ride in the query string, so they have to be chunked. */
const ID_CHUNK = 200

export type Connection = {
  id: string
  account: string
  display_name: string
  session_id: string
  account_uid: string
  currency: string
  consent_expires_at: string | null
  needs_reconnect: boolean
  synced_through: string | null
}

type PreparedTx = {
  user_id: string
  account: string
  bank_transaction_id: string
  booking_date: string
  amount_sek: number
  original_amount: number
  original_currency: string
  fx_source: 'native' | 'bank' | 'daily'
  merchant_raw: string
  merchant_key: string
  category: string
  status: 'pending' | 'settled'
  is_transfer: boolean
}

export type AccountReport = {
  account: string
  imported: number
  reconciled: number
  transfers: number
  skipped: number
  needsReconnect: boolean
  error?: string
}

export type SyncReport = {
  ranAt: string
  accounts: AccountReport[]
  learnedCategories: boolean
}

export async function runSync(userId: string): Promise<SyncReport> {
  const connections = await loadConnections(userId)
  const today = new Date()

  const prepared: PreparedTx[] = []
  const reports: AccountReport[] = []
  const perAccountRaw = new Map<string, EbTransaction[]>()

  // ── 1. Pull ────────────────────────────────────────────────────────────
  for (const conn of connections) {
    const report: AccountReport = {
      account: conn.account,
      imported: 0,
      reconciled: 0,
      transfers: 0,
      skipped: 0,
      needsReconnect: false,
    }
    reports.push(report)

    if (expiredConsent(conn, today)) {
      report.needsReconnect = true
      report.error = 'Consent expired'
      await flagReconnect(conn.id, 'Consent expired')
      continue
    }

    try {
      const txs = await fetchTransactionsSince({
        accountUid: conn.account_uid,
        dateFrom: windowStart(conn, today),
      })
      perAccountRaw.set(conn.account, txs)
    } catch (e) {
      const consentProblem =
        e instanceof EnableBankingError && e.isConsentProblem
      report.needsReconnect = consentProblem
      report.error = String(e instanceof Error ? e.message : e)
      if (consentProblem) await flagReconnect(conn.id, report.error)
      else await recordError(conn.id, report.error)
    }
  }

  // ── 2. Rates, one lookup per (date, currency set) ──────────────────────
  const currenciesByDate = new Map<string, Set<string>>()
  for (const txs of perAccountRaw.values()) {
    for (const tx of txs) {
      const date = bookingDate(tx)
      if (!date) continue
      const set = currenciesByDate.get(date) ?? new Set<string>()
      set.add(tx.transaction_amount?.currency ?? env.homeCurrency)
      currenciesByDate.set(date, set)
    }
  }

  const ratesByDate = new Map<string, Map<string, number>>()
  for (const [date, currencies] of currenciesByDate) {
    ratesByDate.set(date, await ratesFor(date, [...currencies]))
  }

  // ── 3. Shape ───────────────────────────────────────────────────────────
  const staged: {
    conn: Connection
    tx: EbTransaction
    report: AccountReport
  }[] = []
  for (const conn of connections) {
    const report = reports.find((r) => r.account === conn.account)!
    for (const tx of perAccountRaw.get(conn.account) ?? []) {
      if (!usable(tx)) {
        report.skipped++
        continue
      }
      staged.push({ conn, tx, report })
    }
  }

  const categorizer = await buildCategorizer(
    userId,
    staged.map(({ tx }) => {
      const raw = merchantRaw(tx)
      return { key: merchantKey(raw), raw }
    }),
  )

  for (const { conn, tx, report } of staged) {
    const date = bookingDate(tx)!
    const raw = merchantRaw(tx)
    const key = merchantKey(raw)
    const currency = tx.transaction_amount.currency
    const gross = Number(tx.transaction_amount.amount)

    let converted
    try {
      converted = convert({
        amount: gross,
        currency,
        bankInstructed: instructedAmount(tx),
        dailyRates: ratesByDate.get(date) ?? new Map(),
      })
    } catch (e) {
      // A missing rate is a reason to leave the transaction for tomorrow, not
      // to store a wrong number.
      report.skipped++
      report.error ??= String(e instanceof Error ? e.message : e)
      continue
    }

    // Money out is positive spend; money in is a negative expense so refunds
    // net out inside their own category rather than needing a second kind.
    const signed =
      tx.credit_debit_indicator === 'CRDT'
        ? -Math.abs(converted.amountSek)
        : Math.abs(converted.amountSek)

    const category = categorizer.categorize(key, raw)

    prepared.push({
      user_id: userId,
      account: conn.account,
      bank_transaction_id: transactionId(tx, conn.account, date, gross),
      booking_date: date,
      amount_sek: signed,
      original_amount: tx.credit_debit_indicator === 'CRDT' ? -gross : gross,
      original_currency: currency,
      fx_source: converted.source,
      merchant_raw: raw,
      merchant_key: key,
      category,
      status: tx.status === 'BOOK' ? 'settled' : 'pending',
      // A rule mapping a counterparty to "Transfer" is the manual override:
      // add one for your own account names, and for salary or card-bill
      // payments that would otherwise register as giant refunds.
      is_transfer: category === TRANSFER,
    })
  }

  // ── 4. Internal transfers ──────────────────────────────────────────────
  markInternalTransfers(prepared)
  for (const report of reports) {
    report.transfers = prepared.filter(
      (p) => p.account === report.account && p.is_transfer,
    ).length
  }

  // ── 5. Reconcile pending → settled, then write ─────────────────────────
  const reconciled = await reconcilePending(userId, prepared)
  for (const [account, count] of reconciled) {
    const report = reports.find((r) => r.account === account)
    if (report) report.reconciled = count
  }

  await persist(userId, prepared)
  for (const report of reports) {
    report.imported = prepared.filter(
      (p) => p.account === report.account,
    ).length
  }

  // ── 6. Advance the watermark ───────────────────────────────────────────
  for (const conn of connections) {
    const report = reports.find((r) => r.account === conn.account)
    if (!report || report.error) continue
    await admin
      .from('bank_connections')
      .update({
        last_synced_at: new Date().toISOString(),
        synced_through: isoDate(today),
        needs_reconnect: false,
        last_error: '',
      })
      .eq('id', conn.id)
  }

  return {
    ranAt: new Date().toISOString(),
    accounts: reports,
    learnedCategories: categorizer.learned,
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

async function loadConnections(userId: string): Promise<Connection[]> {
  const { data, error } = await admin
    .from('bank_connections')
    .select(
      'id, account, display_name, session_id, account_uid, currency, ' +
        'consent_expires_at, needs_reconnect, synced_through',
    )
    .eq('user_id', userId)
  if (error) throw new Error(`connection load failed: ${error.message}`)
  return (data ?? []) as unknown as Connection[]
}

function expiredConsent(conn: Connection, now: Date): boolean {
  if (!conn.consent_expires_at) return false
  return new Date(conn.consent_expires_at).getTime() <= now.getTime()
}

function windowStart(conn: Connection, today: Date): string {
  const days = conn.synced_through ? LOOKBACK_DAYS : INITIAL_BACKFILL_DAYS
  const from = conn.synced_through ? new Date(conn.synced_through) : today
  from.setDate(from.getDate() - days)
  return isoDate(from)
}

function usable(tx: EbTransaction): boolean {
  if (!tx.transaction_amount?.amount) return false
  if (!Number.isFinite(Number(tx.transaction_amount.amount))) return false
  if (!bookingDate(tx)) return false
  // Rejected and cancelled entries never moved money.
  return tx.status !== 'RJCT' && tx.status !== 'CANC'
}

function bookingDate(tx: EbTransaction): string | null {
  const raw = tx.booking_date ?? tx.value_date ?? tx.transaction_date
  if (!raw) return null
  return raw.slice(0, 10)
}

function instructedAmount(
  tx: EbTransaction,
): { currency: string; amount: number } | undefined {
  const instructed = tx.exchange_rate?.instructed_amount
  if (!instructed?.currency || !instructed.amount) return undefined
  const amount = Number(instructed.amount)
  if (!Number.isFinite(amount)) return undefined
  return { currency: instructed.currency, amount: Math.abs(amount) }
}

/**
 * The dedup key.
 *
 * entry_reference where the bank supplies one. Where it does not — and some
 * do skip it on pending entries — a deterministic composite stands in, so that
 * re-running the same day still lands on the same row instead of inserting a
 * near-duplicate.
 */
function transactionId(
  tx: EbTransaction,
  account: string,
  date: string,
  amount: number,
): string {
  if (tx.entry_reference) return tx.entry_reference
  const merchant = merchantKey(merchantRaw(tx))
  return `synthetic:${account}:${date}:${amount.toFixed(2)}:${merchant}`
}

/**
 * Flag money moved between the owner's own accounts.
 *
 * A debit on one account and a credit of the same size on another, within a
 * day, is a transfer rather than spend — the money never left. Marking both
 * sides keeps the pair out of category totals without deleting anything, so
 * the rows are still there when you want to see them.
 *
 * Only matches across *different* accounts: two equal-and-opposite entries on
 * one account are a refund, which should net out normally.
 */
export function markInternalTransfers(
  rows: Pick<
    PreparedTx,
    'account' | 'booking_date' | 'amount_sek' | 'is_transfer'
  >[],
): number {
  const claimed = new Set<number>()
  let count = 0

  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]!
    if (claimed.has(i) || a.is_transfer || a.amount_sek <= 0) continue

    for (let j = 0; j < rows.length; j++) {
      const b = rows[j]!
      if (i === j || claimed.has(j) || b.is_transfer) continue
      if (b.account === a.account) continue
      if (b.amount_sek >= 0) continue
      if (Math.abs(a.amount_sek + b.amount_sek) > TRANSFER_AMOUNT_EPSILON)
        continue
      if (daysApart(a.booking_date, b.booking_date) > TRANSFER_DAY_WINDOW)
        continue

      a.is_transfer = true
      b.is_transfer = true
      claimed.add(i)
      claimed.add(j)
      count += 2
      break
    }
  }

  return count
}

/**
 * Point an existing pending row at the reference its settled twin arrived with.
 *
 * The prompt's instinct — dedup on the bank's id — is right, but a bank is not
 * obliged to keep entry_reference stable across the pending→booked transition,
 * and several reissue it. Left alone that produces exactly the double count the
 * id-based dedup was meant to prevent. So before writing, any settled row whose
 * id we have never seen goes looking for an orphaned pending row of about the
 * right size and age, and adopts it. The subsequent upsert then updates that
 * row in place, preserving its id, its created_at and any hand-set category.
 */
async function reconcilePending(
  userId: string,
  prepared: PreparedTx[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const accounts = [...new Set(prepared.map((p) => p.account))]
  if (accounts.length === 0) return counts

  const { data, error } = await admin
    .from('expense_transactions')
    .select('id, account, bank_transaction_id, booking_date, amount_sek')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .in('account', accounts)
  if (error) throw new Error(`pending load failed: ${error.message}`)

  const incomingIds = new Set(prepared.map((p) => p.bank_transaction_id))
  // Only pending rows that vanished from the feed are candidates. One still
  // present under its own id will be updated by the upsert on its own.
  const orphans = (data ?? []).filter(
    (row) => !incomingIds.has(row.bank_transaction_id as string),
  ) as {
    id: string
    account: string
    bank_transaction_id: string
    booking_date: string
    amount_sek: number
  }[]
  if (orphans.length === 0) return counts

  const known = await knownIds(userId, accounts, [...incomingIds])

  const taken = new Set<string>()
  for (const row of prepared) {
    if (row.status !== 'settled') continue
    if (known.has(row.bank_transaction_id)) continue

    const match = orphans.find(
      (o) =>
        !taken.has(o.id) &&
        o.account === row.account &&
        Math.sign(o.amount_sek) === Math.sign(row.amount_sek) &&
        withinTolerance(Number(o.amount_sek), row.amount_sek) &&
        daysApart(o.booking_date, row.booking_date) <= RECONCILE_DAY_WINDOW,
    )
    if (!match) continue

    taken.add(match.id)
    const { error: updateError } = await admin
      .from('expense_transactions')
      .update({ bank_transaction_id: row.bank_transaction_id })
      .eq('id', match.id)
    if (updateError) {
      console.error('[sync] reconcile failed:', updateError.message)
      continue
    }
    counts.set(row.account, (counts.get(row.account) ?? 0) + 1)
  }

  return counts
}

/**
 * Which of `ids` we already hold rows for.
 *
 * Chunked because PostgREST puts `in` lists in the query string, and a 90-day
 * first backfill can carry a few thousand references — enough to blow past the
 * URL length limit and fail the whole run.
 */
async function knownIds(
  userId: string,
  accounts: string[],
  ids: string[],
): Promise<Set<string>> {
  const known = new Set<string>()
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await admin
      .from('expense_transactions')
      .select('bank_transaction_id')
      .eq('user_id', userId)
      .in('account', accounts)
      .in('bank_transaction_id', ids.slice(i, i + ID_CHUNK))
    if (error) throw new Error(`existing-id load failed: ${error.message}`)
    for (const row of data ?? []) known.add(row.bank_transaction_id as string)
  }
  return known
}

function withinTolerance(a: number, b: number): boolean {
  const allowed = Math.max(
    RECONCILE_MIN_TOLERANCE_SEK,
    Math.abs(a) * RECONCILE_AMOUNT_TOLERANCE,
  )
  return Math.abs(Math.abs(a) - Math.abs(b)) <= allowed
}

function daysApart(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Math.round(ms / 86400000)
}

/**
 * Write the batch, leaving hand-corrected categories alone.
 *
 * A category you fixed by hand is a correction to the categoriser, not to the
 * transaction — so re-import must not undo it.
 */
async function persist(userId: string, rows: PreparedTx[]): Promise<void> {
  if (rows.length === 0) return

  const ids = [...new Set(rows.map((r) => r.bank_transaction_id))]
  const pinned = new Map<string, string>()
  // Chunked for the same reason as knownIds: the filter goes in the URL.
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data: locked, error } = await admin
      .from('expense_transactions')
      .select('account, bank_transaction_id, category')
      .eq('user_id', userId)
      .eq('category_locked', true)
      .in('bank_transaction_id', ids.slice(i, i + ID_CHUNK))
    if (error) throw new Error(`locked-category load failed: ${error.message}`)
    for (const r of locked ?? []) {
      pinned.set(`${r.account}:${r.bank_transaction_id}`, r.category as string)
    }
  }

  const payload = rows.map((r) => {
    const pin = pinned.get(`${r.account}:${r.bank_transaction_id}`)
    return pin ? { ...r, category: pin } : r
  })

  // Chunked so a large first-run backfill doesn't hit the request size cap.
  for (let i = 0; i < payload.length; i += 500) {
    const { error: writeError } = await admin
      .from('expense_transactions')
      .upsert(payload.slice(i, i + 500), {
        onConflict: 'user_id,account,bank_transaction_id',
      })
    if (writeError)
      throw new Error(`transaction write failed: ${writeError.message}`)
  }
}

async function flagReconnect(id: string, reason: string): Promise<void> {
  await admin
    .from('bank_connections')
    .update({ needs_reconnect: true, last_error: reason.slice(0, 500) })
    .eq('id', id)
}

async function recordError(id: string, reason: string): Promise<void> {
  await admin
    .from('bank_connections')
    .update({ last_error: reason.slice(0, 500) })
    .eq('id', id)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
