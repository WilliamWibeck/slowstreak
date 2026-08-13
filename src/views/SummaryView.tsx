import { useMemo, useState } from 'react'
import {
  addDays,
  calendarWeek,
  isoLocal,
  noteDateLabel,
  weekRangeLabel,
} from '@/lib/date'
import { money as formatMoney } from '@/lib/format'
import { windowStart } from '@/lib/series'
import { buildWeekSummary, change } from '@/lib/week-summary'
import { Sparkline } from '@/components/Sparkline'
import { useTracker } from '@/state/TrackerContext'

const IMPORT_CURRENCY = 'SEK'

function pct(n: number): string {
  return Math.round(n * 100) + '%'
}

function hoursLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

function DeltaLabel({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-xs text-neutral-600">new</span>
  const sign = value >= 0 ? '+' : ''
  return (
    <span
      className="text-xs"
      style={{
        color:
          value >= 0 ? 'var(--color-accent-300)' : 'var(--color-neutral-400)',
      }}
    >
      {sign}
      {value.toFixed(1)}%
    </span>
  )
}

export function SummaryView() {
  const {
    today,
    todayISO,
    habits,
    seriesByHabit,
    notesByDate,
    transactions,
    connections,
    goDashboard,
    goNotes,
    selectNote,
  } = useTracker()

  const [offset, setOffset] = useState(0)

  const week = useMemo(
    () => calendarWeek(addDays(today, offset * 7)),
    [today, offset],
  )

  const canGoPrev = isoLocal(addDays(week[0]!, -7)) >= windowStart(today)
  const canGoNext = offset < 0

  const summary = useMemo(
    () =>
      buildWeekSummary(
        week,
        todayISO,
        habits,
        seriesByHabit,
        notesByDate,
        transactions,
      ),
    [week, todayISO, habits, seriesByHabit, notesByDate, transactions],
  )

  const showSpend = transactions.length > 0 || connections.length > 0
  const empty =
    habits.length === 0 &&
    summary.notes.length === 0 &&
    summary.categories.length === 0

  const possible = habits.length * summary.elapsed
  const title = summary.isCurrent
    ? 'This week'
    : offset === -1
      ? 'Last week'
      : weekRangeLabel(week)
  const compared =
    summary.isCurrent && summary.elapsed < 7
      ? `Through today · compared with the same ${summary.elapsed} days last week`
      : 'Compared with the week before'

  if (empty && offset === 0) {
    return (
      <div>
        <header className="border-b border-divider pb-8">
          <div className="mb-3 text-[10px] tracking-[0.12em] text-accent uppercase">
            Week
          </div>
          <h1 className="m-0 font-heading text-[30px] font-medium tracking-tight">
            Weekly summary
          </h1>
        </header>
        <div className="card mt-8 items-start gap-4 p-8 shadow-sm">
          <div className="font-heading text-[17px] font-medium">
            Nothing to summarise yet
          </div>
          <p className="m-0 max-w-[46ch] text-[13px] leading-relaxed text-neutral-500">
            Log a few days, jot a note, or connect a bank — this page recaps the
            week against the one before it.
          </p>
          <button onClick={goDashboard} className="btn btn-primary mt-2">
            Go to dashboard
          </button>
        </div>
      </div>
    )
  }

  const cards = [
    {
      label: 'Time logged',
      value: hoursLabel(summary.totalMinutes),
      delta: change(summary.totalMinutes, summary.priorMinutes),
    },
    {
      label: 'Completion',
      value: pct(summary.completion),
      delta: change(summary.completion, summary.priorCompletion),
    },
    {
      label: 'Days logged',
      value: possible ? `${summary.totalDays}/${possible}` : '—',
      delta: change(summary.totalDays, summary.priorDays),
    },
    ...(showSpend
      ? [
          {
            label: 'Spend',
            value: formatMoney(summary.spend, IMPORT_CURRENCY),
            delta: change(summary.spend, summary.priorSpend),
          },
        ]
      : []),
  ]

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-divider pb-8">
        <div>
          <div className="mb-3 text-[10px] tracking-[0.12em] text-accent uppercase">
            Week
          </div>
          <h1 className="m-0 font-heading text-[30px] font-medium tracking-tight">
            {title}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((n) => n - 1)}
              disabled={!canGoPrev}
              aria-label="Previous week"
              className="btn btn-ghost btn-icon min-h-11 min-w-11"
            >
              ‹
            </button>
            <div className="min-w-[9.5rem] text-center text-[13px] text-neutral-400">
              {weekRangeLabel(week)}
            </div>
            <button
              type="button"
              onClick={() => setOffset((n) => Math.min(0, n + 1))}
              disabled={!canGoNext}
              aria-label="Next week"
              className="btn btn-ghost btn-icon min-h-11 min-w-11"
            >
              ›
            </button>
          </div>
          <div className="text-[11px] text-neutral-500">{compared}</div>
        </div>
      </header>

      <section
        className={
          'mt-8 grid gap-4 ' +
          (cards.length === 4
            ? 'grid-cols-2 xl:grid-cols-4'
            : 'grid-cols-2 xl:grid-cols-3')
        }
      >
        {cards.map((c) => (
          <div key={c.label} className="card gap-2 p-6 shadow-sm">
            <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              {c.label}
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-heading text-[27px] font-medium">
                {c.value}
              </span>
              <DeltaLabel value={c.delta} />
            </div>
          </div>
        ))}
      </section>

      {habits.length > 0 && (
        <section className="mt-8 overflow-x-auto">
          <table className="table" style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th>Habit</th>
                <th className="text-right">Days</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Minutes</th>
                <th className="text-right">Avg</th>
                <th className="text-right">Change</th>
                <th className="text-right">Week</th>
              </tr>
            </thead>
            <tbody>
              {summary.perHabit.map((h) => (
                <tr key={h.id}>
                  <td>
                    <div className="text-sm">{h.name}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {h.target} min target
                    </div>
                  </td>
                  <td className="text-right">
                    {h.days}/{summary.elapsed}
                  </td>
                  <td className="text-right">{pct(h.rate)}</td>
                  <td className="text-right text-neutral-400">{h.minutes}</td>
                  <td className="text-right text-neutral-400">
                    {h.avg ? h.avg + 'm' : '—'}
                  </td>
                  <td className="text-right">
                    <DeltaLabel value={change(h.minutes, h.priorMinutes)} />
                  </td>
                  <td>
                    <div className="flex h-[26px] items-end justify-end">
                      <Sparkline
                        bars={h.spark}
                        color={
                          h.minutes >= h.priorMinutes
                            ? 'var(--color-accent-700)'
                            : 'var(--color-neutral-800)'
                        }
                        barWidth={1}
                        height={26}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {showSpend && summary.categories.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between pb-4">
            <h2 className="m-0 text-[11px] font-normal tracking-[0.12em] text-neutral-500 uppercase">
              Spend by category
            </h2>
            {summary.pendingSpend > 0 && (
              <div className="text-[11px] text-neutral-500">
                {formatMoney(summary.pendingSpend, IMPORT_CURRENCY)} pending
              </div>
            )}
          </div>
          <div className="card overflow-x-auto p-0 shadow-sm">
            <table className="table" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">This week</th>
                  <th className="text-right">Prior</th>
                  <th className="text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {summary.categories.map((c) => (
                  <tr key={c.category}>
                    <td>
                      <div className="text-sm">{c.category}</div>
                      {c.pending > 0 && (
                        <div className="mt-0.5 text-[11px] text-neutral-500">
                          {formatMoney(c.pending, IMPORT_CURRENCY)} pending
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      {formatMoney(c.spent, IMPORT_CURRENCY)}
                    </td>
                    <td className="text-right text-neutral-400">
                      {formatMoney(c.prior, IMPORT_CURRENCY)}
                    </td>
                    <td className="text-right">
                      <DeltaLabel value={change(c.spent, c.prior)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {summary.notes.length > 0 && (
        <section className="mt-8">
          <h2 className="m-0 pb-4 text-[11px] font-normal tracking-[0.12em] text-neutral-500 uppercase">
            Notes
          </h2>
          <div className="flex flex-col gap-3">
            {summary.notes.map((n) => (
              <button
                key={n.date}
                type="button"
                onClick={() => {
                  selectNote(n.date)
                  goNotes()
                }}
                className="card w-full cursor-pointer items-start gap-2 appearance-none border-0 p-6 text-left shadow-sm"
              >
                <div className="text-[11px] text-neutral-500">
                  {noteDateLabel(n.date, todayISO)} · {n.date}
                </div>
                <p className="m-0 line-clamp-4 text-[13px] leading-relaxed text-neutral-300">
                  {n.body}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
