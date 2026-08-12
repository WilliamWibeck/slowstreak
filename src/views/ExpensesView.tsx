import { CADENCES, cadenceById } from '@/data/expenses'
import type { BillRow } from '@/lib/database.types'
import { ordinal } from '@/lib/date'
import { money as formatMoney } from '@/lib/format'
import { useTracker } from '@/state/TrackerContext'
import { BillModal } from '@/components/BillModal'
import { MeterBar } from '@/components/MeterBar'

function monthlyOf(b: BillRow): number {
  return b.amount * cadenceById(b.cadence).per
}

export function ExpensesView() {
  const { bills, today, newBill, editBill, removeBill, currency } = useTracker()
  const money = (n: number) => formatMoney(n, currency)

  const monthlyTotal = bills.reduce((sum, b) => sum + monthlyOf(b), 0)
  const catTotals: Record<string, number> = {}
  bills.forEach((b) => {
    catTotals[b.category] = (catTotals[b.category] ?? 0) + monthlyOf(b)
  })
  const cats = Object.keys(catTotals)
    .map((k) => ({ name: k, value: catTotals[k]! }))
    .sort((a, b) => b.value - a.value)
  const catMax = cats.length ? cats[0]!.value : 0
  const top = cats[0] ?? null

  const todayDay = today.getDate()
  const monthlyBills = bills
    .filter((b) => b.cadence === 'monthly')
    .slice()
    .sort((a, b) => a.due_day - b.due_day)
  const next =
    monthlyBills.find((b) => b.due_day >= todayDay) ?? monthlyBills[0] ?? null
  const dueRemaining = monthlyBills
    .filter((b) => b.due_day >= todayDay)
    .reduce((s, b) => s + b.amount, 0)

  const sortedBills = bills.slice().sort((a, b) => monthlyOf(b) - monthlyOf(a))

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-divider pb-8">
        <div>
          <div className="mb-3 text-[10px] tracking-[0.12em] text-accent uppercase">
            Spending
          </div>
          <h1 className="m-0 font-heading text-[30px] font-medium tracking-tight">
            Bills and expenses
          </h1>
        </div>
        <div className="flex items-end gap-8">
          <div>
            <div className="mb-2 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              Per month
            </div>
            <div className="font-heading text-2xl font-medium">
              {money(monthlyTotal)}
            </div>
          </div>
          <button onClick={newBill} className="btn btn-primary min-h-11">
            Add a bill
          </button>
        </div>
      </header>

      {bills.length === 0 ? (
        <div className="card mt-8 items-start gap-4 p-8 shadow-sm">
          <div className="font-heading text-[17px] font-medium">
            No bills tracked
          </div>
          <p className="m-0 max-w-[46ch] text-[13px] leading-relaxed text-neutral-500">
            Add your recurring costs and this page works out the monthly
            equivalent, where the money goes by category, and what's still to
            leave the account this month.
          </p>
          <button onClick={newBill} className="btn btn-primary mt-2">
            Add your first bill
          </button>
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="card min-w-0 gap-2 p-6 shadow-sm">
              <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                Monthly
              </div>
              <div className="font-heading text-[26px] font-medium">
                {money(monthlyTotal)}
              </div>
              <div className="text-[11px] text-neutral-500">
                {bills.length}{' '}
                {bills.length === 1 ? 'bill tracked' : 'bills tracked'}
              </div>
            </div>
            <div className="card min-w-0 gap-2 p-6 shadow-sm">
              <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                Per year
              </div>
              <div className="font-heading text-[26px] font-medium">
                {money(monthlyTotal * 12)}
              </div>
              <div className="text-[11px] text-neutral-500">
                All cadences combined
              </div>
            </div>
            <div className="card min-w-0 gap-2 p-6 shadow-sm">
              <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                Largest slice
              </div>
              <div className="font-heading text-[26px] font-medium">
                {top ? top.name : '—'}
              </div>
              <div className="text-[11px] text-neutral-500">
                {top ? money(top.value) + ' a month' : 'Nothing tracked yet'}
              </div>
            </div>
            <div className="card min-w-0 gap-2 p-6 shadow-sm">
              <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                Next due
              </div>
              <div className="font-heading text-[26px] font-medium">
                {next ? ordinal(next.due_day) : '—'}
              </div>
              <div className="text-[11px] text-neutral-500">
                {next
                  ? next.name + ' · ' + money(next.amount)
                  : 'Nothing scheduled'}
              </div>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card min-w-0 gap-6 p-6 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div className="font-heading text-[15px] font-medium">
                  Where it goes
                </div>
                <div className="text-[11px] text-neutral-500">
                  Monthly equivalent
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {cats.map((c) => (
                  <MeterBar
                    key={c.name}
                    label={c.name}
                    meta={`${money(c.value)} · ${Math.round(
                      (c.value / (monthlyTotal || 1)) * 100,
                    )}%`}
                    pct={Math.max(2, (c.value / (catMax || 1)) * 100)}
                  />
                ))}
              </div>
            </div>

            <div className="card min-w-0 gap-4 p-6 shadow-sm">
              <div className="font-heading text-[15px] font-medium">
                Due this month
              </div>
              <div className="flex flex-col">
                {monthlyBills.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-baseline justify-between gap-4 border-b border-divider py-3"
                  >
                    <div className="flex min-w-0 items-baseline gap-4">
                      <span
                        className="min-w-[34px] text-[11px]"
                        style={{
                          color:
                            b.due_day < todayDay
                              ? 'var(--color-neutral-600)'
                              : 'var(--color-accent)',
                        }}
                      >
                        {ordinal(b.due_day)}
                      </span>
                      <span className="truncate">{b.name}</span>
                    </div>
                    <span className="text-neutral-400">{money(b.amount)}</span>
                  </div>
                ))}
                {monthlyBills.length === 0 && (
                  <div className="text-[13px] text-neutral-600">
                    No monthly bills.
                  </div>
                )}
              </div>
              <div className="text-[11px] leading-relaxed text-neutral-600">
                {dueRemaining > 0
                  ? money(dueRemaining) +
                    ' still to leave the account this month'
                  : 'Everything for this month has come out'}
              </div>
            </div>
          </section>

          <section className="mt-4 overflow-x-auto">
            <table className="table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th className="text-left">Bill</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Cadence</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Per month</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedBills.map((b) => (
                  <tr key={b.id}>
                    <td
                      onClick={() => editBill(b.id)}
                      className="cursor-pointer"
                    >
                      {b.name}
                    </td>
                    <td className="text-neutral-400">{b.category}</td>
                    <td className="text-neutral-400">
                      {CADENCES.find((c) => c.id === b.cadence)?.label ??
                        b.cadence}
                    </td>
                    <td className="text-right">{money(b.amount)}</td>
                    <td className="text-right text-accent-300">
                      {money(monthlyOf(b))}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeBill(b.id)
                        }}
                        className="btn btn-ghost text-[11px]"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <BillModal />
    </div>
  )
}
