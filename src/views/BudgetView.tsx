import { useMemo, useState } from 'react'
import { CATEGORIES, UNCATEGORIZED } from '@/data/categories'
import {
  fillPct,
  monthKey,
  monthTotal,
  monthlyTrend,
  spendByCategory,
} from '@/lib/budget'
import { money as formatMoney } from '@/lib/format'
import { Sparkline } from '@/components/Sparkline'
import { MeterBar } from '@/components/MeterBar'
import { useTracker } from '@/state/TrackerContext'

/**
 * Spend against target for the current month, plus a six-month trend.
 *
 * Everything imported is stored in SEK, so amounts here are formatted as SEK
 * regardless of the sidebar's display currency — that setting governs the
 * manually-entered bills, which have no exchange rate behind them.
 */
const IMPORT_CURRENCY = 'SEK'

export function BudgetView() {
  const {
    transactions,
    connections,
    budgetTargets,
    setBudgetTarget,
    recategorize,
    today,
  } = useTracker()

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const money = (n: number) => formatMoney(n, IMPORT_CURRENCY)
  const month = monthKey(today)

  const categories = useMemo(
    () => spendByCategory(transactions, month, budgetTargets),
    [transactions, month, budgetTargets],
  )
  const trend = useMemo(
    () => monthlyTrend(transactions, today),
    [transactions, today],
  )

  const spent = monthTotal(transactions, month)
  const budgeted = Object.values(budgetTargets).reduce((s, v) => s + v, 0)
  const pending = categories.reduce((s, c) => s + c.pending, 0)
  const overCount = categories.filter(
    (c) => c.target !== null && c.spent > c.target,
  ).length

  const trendMax = Math.max(...trend.map((m) => m.total), 1)
  const prior = trend.slice(0, -1)
  const priorAverage = prior.length
    ? prior.reduce((s, m) => s + m.total, 0) / prior.length
    : 0

  const stale = connections.filter((c) => c.needs_reconnect)
  const monthLabel = today.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  function startEdit(category: string, target: number | null) {
    setEditing(category)
    setDraft(target === null ? '' : String(target))
  }

  function commitEdit() {
    if (!editing) return
    const value = Number(draft)
    // An empty box clears the target rather than setting it to zero — "no
    // budget here" and "budget of nothing" are different statements.
    setBudgetTarget(editing, draft.trim() === '' || !(value > 0) ? null : value)
    setEditing(null)
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-divider pb-8">
        <div>
          <div className="mb-3 text-[10px] tracking-[0.12em] text-accent uppercase">
            Budget
          </div>
          <h1 className="m-0 font-heading text-[30px] font-medium tracking-tight">
            {monthLabel}
          </h1>
        </div>
        <div className="flex items-end gap-8">
          <div>
            <div className="mb-2 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              Spent so far
            </div>
            <div className="font-heading text-2xl font-medium">
              {money(spent)}
            </div>
          </div>
          {budgeted > 0 && (
            <div>
              <div className="mb-2 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                Budgeted
              </div>
              <div className="font-heading text-2xl font-medium text-neutral-400">
                {money(budgeted)}
              </div>
            </div>
          )}
        </div>
      </header>

      {stale.length > 0 && (
        <div
          role="alert"
          className="mt-6 rounded-md px-4 py-3 text-[13px]"
          style={{
            background: 'color-mix(in srgb, #f87171 12%, transparent)',
            color: '#fca5a5',
          }}
        >
          {stale.map((c) => c.display_name || c.account).join(', ')}{' '}
          {stale.length === 1 ? 'needs' : 'need'} reconnecting — the bank
          consent has lapsed, so those transactions have stopped arriving.
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="card mt-8 items-start gap-4 p-8 shadow-sm">
          <div className="font-heading text-[17px] font-medium">
            Nothing imported yet
          </div>
          <p className="m-0 max-w-[52ch] text-[13px] leading-relaxed text-neutral-500">
            Once a bank is connected, the nightly job pulls new transactions and
            this page fills in: where the money went this month, how that
            compares to your targets, and which way the total is heading.
            Connect an account with{' '}
            <code className="text-accent-300">/api/connect/start?bank=seb</code>
            .
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="card min-w-0 gap-2 p-6 shadow-sm">
              <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                This month
              </div>
              <div className="font-heading text-[26px] font-medium">
                {money(spent)}
              </div>
              <div className="text-[11px] text-neutral-500">
                {pending > 0
                  ? money(pending) + ' of it still pending'
                  : 'All settled'}
              </div>
            </div>
            <div className="card min-w-0 gap-2 p-6 shadow-sm">
              <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                Left to spend
              </div>
              <div
                className="font-heading text-[26px] font-medium"
                style={{
                  color:
                    budgeted > 0 && spent > budgeted
                      ? 'var(--color-over-budget)'
                      : undefined,
                }}
              >
                {budgeted > 0 ? money(budgeted - spent) : '—'}
              </div>
              <div className="text-[11px] text-neutral-500">
                {budgeted > 0 ? 'Against your targets' : 'No targets set yet'}
              </div>
            </div>
            <div className="card min-w-0 gap-2 p-6 shadow-sm">
              <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                Over target
              </div>
              <div
                className="font-heading text-[26px] font-medium"
                style={{
                  color: overCount ? 'var(--color-over-budget)' : undefined,
                }}
              >
                {overCount || '—'}
              </div>
              <div className="text-[11px] text-neutral-500">
                {overCount === 1 ? 'category' : 'categories'}
              </div>
            </div>
            <div className="card min-w-0 gap-2 p-6 shadow-sm">
              <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                Vs. recent months
              </div>
              <div className="font-heading text-[26px] font-medium">
                {priorAverage > 0
                  ? (spent >= priorAverage ? '+' : '') +
                    Math.round(((spent - priorAverage) / priorAverage) * 100) +
                    '%'
                  : '—'}
              </div>
              <div className="text-[11px] text-neutral-500">
                {priorAverage > 0
                  ? money(Math.round(priorAverage)) + ' average'
                  : 'Not enough history'}
              </div>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card min-w-0 gap-6 p-6 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div className="font-heading text-[15px] font-medium">
                  Spent vs target
                </div>
                <div className="text-[11px] text-neutral-500">
                  Click a target to change it
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {categories.map((c) => {
                  const over = c.target !== null && c.spent > c.target
                  return (
                    <div key={c.category} className="flex flex-col gap-2">
                      <MeterBar
                        label={c.category}
                        meta={
                          c.target === null
                            ? money(c.spent)
                            : `${money(c.spent)} / ${money(c.target)}`
                        }
                        pct={
                          c.target === null
                            ? // No target to measure against, so the bar reads
                              // as a share of the month's largest category.
                              Math.min(
                                100,
                                (c.spent / (categories[0]?.spent || 1)) * 100,
                              )
                            : fillPct(c.spent, c.target)
                        }
                        pendingPct={
                          c.target === null ? 0 : fillPct(c.pending, c.target)
                        }
                        over={over}
                        muted={c.target === null}
                      />
                      {editing === c.category ? (
                        <input
                          className="input min-h-0 py-1 text-[11px]"
                          autoFocus
                          inputMode="numeric"
                          placeholder="Monthly target in SEK — blank to clear"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit()
                            if (e.key === 'Escape') setEditing(null)
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(c.category, c.target)}
                          className="self-start text-[11px] text-neutral-600 hover:text-accent"
                        >
                          {c.target === null
                            ? 'Set a target'
                            : over
                              ? money(c.spent - c.target) + ' over'
                              : money(c.target - c.spent) + ' left'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card min-w-0 gap-6 p-6 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div className="font-heading text-[15px] font-medium">
                  Last six months
                </div>
                <div className="text-[11px] text-neutral-500">Total spend</div>
              </div>

              <Sparkline
                bars={trend.map((m) => ({
                  heightPct: (m.total / trendMax) * 100,
                }))}
                color="var(--color-accent)"
                height={96}
                barWidth={14}
              />
              <div className="flex gap-[2px]">
                {trend.map((m) => (
                  <div
                    key={m.month}
                    className="min-w-0 flex-1 text-center text-[10px] text-neutral-600"
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                {[...trend].reverse().map((m, i) => (
                  <div
                    key={m.month}
                    className="flex items-baseline justify-between border-b border-divider py-2 text-xs"
                  >
                    <span className={i === 0 ? 'text-accent' : ''}>
                      {m.label}
                      {i === 0 && (
                        <span className="ml-2 text-[10px] text-neutral-600">
                          so far
                        </span>
                      )}
                    </span>
                    <span className="text-neutral-400 tabular-nums">
                      {money(m.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <RecentTransactions
            month={month}
            onRecategorize={recategorize}
            money={money}
          />
        </>
      )}
    </div>
  )
}

/**
 * This month's transactions, newest first.
 *
 * Present mostly so a miscategorised row can be fixed on the spot — the
 * categoriser will be wrong sometimes, and the correction is what teaches it.
 */
function RecentTransactions({
  month,
  onRecategorize,
  money,
}: {
  month: string
  onRecategorize: (id: string, category: string) => void
  money: (n: number) => string
}) {
  const { transactions } = useTracker()
  const rows = transactions
    .filter((t) => t.booking_date.slice(0, 7) === month)
    .slice(0, 60)

  if (rows.length === 0) return null

  return (
    <section className="mt-4 overflow-x-auto">
      <table className="table" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            <th className="text-left">Date</th>
            <th className="text-left">Merchant</th>
            <th className="text-left">Account</th>
            <th className="text-left">Category</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} style={{ opacity: t.is_transfer ? 0.45 : 1 }}>
              <td className="text-neutral-400">{t.booking_date.slice(5)}</td>
              <td>
                <span className="truncate">{t.merchant_raw}</span>
                {t.status === 'pending' && (
                  <span className="ml-2 text-[10px] tracking-[0.08em] text-accent-300 uppercase">
                    pending
                  </span>
                )}
              </td>
              <td className="text-neutral-500">{t.account}</td>
              <td>
                {t.is_transfer ? (
                  <span className="text-neutral-600">Transfer</span>
                ) : (
                  <select
                    value={t.category}
                    aria-label={`Category for ${t.merchant_raw}`}
                    onChange={(e) => onRecategorize(t.id, e.target.value)}
                    className="input min-h-0 w-auto py-1 text-[11px]"
                  >
                    {[...CATEGORIES, UNCATEGORIZED].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {/* A category the sync produced that is no longer in the
                        list would otherwise silently reset the select. */}
                    {![...CATEGORIES, UNCATEGORIZED].includes(
                      t.category as (typeof CATEGORIES)[number],
                    ) && <option value={t.category}>{t.category}</option>}
                  </select>
                )}
              </td>
              <td
                className="text-right tabular-nums"
                style={{
                  color:
                    t.amount_sek < 0 ? 'var(--color-accent-300)' : undefined,
                }}
              >
                {money(t.amount_sek)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
