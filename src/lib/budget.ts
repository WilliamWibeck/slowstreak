import type { ExpenseTransactionRow } from '@/lib/database.types'

/**
 * Turning imported transactions into the numbers the budget page renders.
 *
 * Two rules run through everything here:
 *
 *   • Transfers never count. Moving money between your own accounts is not
 *     spending, and counting it would double every internal move.
 *   • Refunds net out. They are stored as negative amounts under the same
 *     category, so a refunded purchase leaves that category where it started
 *     rather than needing a second row type to cancel it.
 */

export type CategorySpend = {
  category: string
  /** Settled plus pending, netted. What "spent so far" means. */
  spent: number
  /** The pending share of `spent`, so the page can shade it differently. */
  pending: number
  /** Monthly target in SEK, or null when none is set. */
  target: number | null
}

export type MonthTotal = {
  /** 'YYYY-MM'. */
  month: string
  label: string
  total: number
}

/** 'YYYY-MM' for a local date — never via toISOString, which shifts to UTC. */
export function monthKey(d: Date): string {
  const m = d.getMonth() + 1
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}`
}

/** The 'YYYY-MM' a transaction's booking date falls in. */
export function monthOf(tx: ExpenseTransactionRow): string {
  return tx.booking_date.slice(0, 7)
}

/** Real spend only: transfers dropped, refunds left negative to net out. */
export function spendable(
  transactions: ExpenseTransactionRow[],
): ExpenseTransactionRow[] {
  return transactions.filter((t) => !t.is_transfer)
}

/**
 * Spend by category for one month, biggest first.
 *
 * Categories with a target but no spending still appear — a budget you have
 * not touched is exactly the one worth seeing.
 */
export function spendByCategory(
  transactions: ExpenseTransactionRow[],
  month: string,
  targets: Record<string, number>,
): CategorySpend[] {
  const spent = new Map<string, number>()
  const pending = new Map<string, number>()

  for (const tx of spendable(transactions)) {
    if (monthOf(tx) !== month) continue
    const amount = Number(tx.amount_sek)
    spent.set(tx.category, (spent.get(tx.category) ?? 0) + amount)
    if (tx.status === 'pending') {
      pending.set(tx.category, (pending.get(tx.category) ?? 0) + amount)
    }
  }

  for (const category of Object.keys(targets)) {
    if (!spent.has(category)) spent.set(category, 0)
  }

  return [...spent.entries()]
    .map(([category, value]) => ({
      category,
      spent: round2(value),
      pending: round2(pending.get(category) ?? 0),
      target: targets[category] ?? null,
    }))
    .sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category))
}

/** Net spend across every category in a month. */
export function monthTotal(
  transactions: ExpenseTransactionRow[],
  month: string,
): number {
  let total = 0
  for (const tx of spendable(transactions)) {
    if (monthOf(tx) === month) total += Number(tx.amount_sek)
  }
  return round2(total)
}

/**
 * Total spend per month over a trailing window, oldest first.
 *
 * Months with no transactions are emitted as zero rather than skipped, so a
 * quiet month reads as a dip in the trend instead of vanishing from it.
 */
export function monthlyTrend(
  transactions: ExpenseTransactionRow[],
  today: Date,
  months = 6,
): MonthTotal[] {
  const totals = new Map<string, number>()
  for (const tx of spendable(transactions)) {
    const key = monthOf(tx)
    totals.set(key, (totals.get(key) ?? 0) + Number(tx.amount_sek))
  }

  const out: MonthTotal[] = []
  for (let i = months - 1; i >= 0; i--) {
    // Day 1 so month arithmetic never lands on a nonexistent 31st.
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = monthKey(d)
    out.push({
      month: key,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      total: round2(totals.get(key) ?? 0),
    })
  }
  return out
}

/** How far into a category's target the spending has got, capped for layout. */
export function fillPct(spent: number, target: number | null): number {
  if (!target || target <= 0) return 0
  return Math.max(0, Math.min(100, (spent / target) * 100))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
