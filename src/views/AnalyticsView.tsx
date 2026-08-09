import { useMemo } from 'react'
import type { DayEntry } from '@/types'
import { useTracker } from '@/state/TrackerContext'
import { Sparkline } from '@/components/Sparkline'

const WINDOW = 30

function pct(n: number): string {
  return Math.round(n * 100) + '%'
}

/** Signed percentage change, or null when there's no prior period to compare. */
function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
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

export function AnalyticsView() {
  const { habits, seriesByHabit, goDashboard } = useTracker()

  const stats = useMemo(() => {
    // Split each habit's window into the last 30 days and the 30 before it.
    const perHabit = habits.map((h) => {
      const days: DayEntry[] = seriesByHabit[h.id]?.days ?? []
      const recent = days.slice(-WINDOW)
      const prior = days.slice(-WINDOW * 2, -WINDOW)

      const sum = (ds: DayEntry[]) => ds.reduce((a, d) => a + d.minutes, 0)
      const hits = (ds: DayEntry[]) => ds.filter((d) => d.minutes > 0).length

      const recentMin = sum(recent)
      const recentHits = hits(recent)

      return {
        id: h.id,
        name: h.name,
        target: h.target_minutes,
        streak: seriesByHabit[h.id]?.streak ?? 0,
        minutes: recentMin,
        priorMinutes: sum(prior),
        days: recentHits,
        priorDays: hits(prior),
        rate: recentHits / WINDOW,
        avg: recentHits ? Math.round(recentMin / recentHits) : 0,
        spark: recent.map((d) => ({
          heightPct: Math.max(
            2,
            Math.min(100, (d.minutes / Math.max(1, h.target_minutes)) * 100),
          ),
        })),
      }
    })

    const totalMinutes = perHabit.reduce((a, h) => a + h.minutes, 0)
    const priorMinutes = perHabit.reduce((a, h) => a + h.priorMinutes, 0)
    const totalDays = perHabit.reduce((a, h) => a + h.days, 0)
    const priorDays = perHabit.reduce((a, h) => a + h.priorDays, 0)
    const possible = habits.length * WINDOW
    const priorPossible = possible
    const bestStreak = perHabit.reduce((a, h) => Math.max(a, h.streak), 0)
    const activeDays = perHabit.length ? totalDays : 0

    return {
      perHabit,
      totalMinutes,
      priorMinutes,
      totalDays,
      priorDays,
      completion: possible ? totalDays / possible : 0,
      priorCompletion: priorPossible ? priorDays / priorPossible : 0,
      bestStreak,
      avgSession: activeDays ? Math.round(totalMinutes / activeDays) : 0,
      priorAvgSession: priorDays ? Math.round(priorMinutes / priorDays) : 0,
    }
  }, [habits, seriesByHabit])

  if (habits.length === 0) {
    return (
      <div>
        <header className="border-b border-divider pb-8">
          <div className="mb-3 text-[10px] tracking-[0.12em] text-accent uppercase">
            Analytics
          </div>
          <h1 className="m-0 font-heading text-[30px] font-medium tracking-tight">
            Your patterns
          </h1>
        </header>
        <div className="card mt-8 items-start gap-4 p-8 shadow-sm">
          <div className="font-heading text-[17px] font-medium">
            Nothing to analyse yet
          </div>
          <p className="m-0 max-w-[46ch] text-[13px] leading-relaxed text-neutral-500">
            Add a habit and log a few days — this page compares the last 30 days
            against the 30 before them.
          </p>
          <button onClick={goDashboard} className="btn btn-primary mt-2">
            Go to dashboard
          </button>
        </div>
      </div>
    )
  }

  const hours = Math.floor(stats.totalMinutes / 60)
  const mins = stats.totalMinutes % 60

  const cards = [
    {
      label: 'Time logged',
      value: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
      delta: change(stats.totalMinutes, stats.priorMinutes),
    },
    {
      label: 'Completion',
      value: pct(stats.completion),
      delta: change(stats.completion, stats.priorCompletion),
    },
    {
      label: 'Days logged',
      value: `${stats.totalDays}`,
      delta: change(stats.totalDays, stats.priorDays),
    },
    {
      label: 'Avg session',
      value: stats.avgSession ? `${stats.avgSession} min` : '—',
      delta: change(stats.avgSession, stats.priorAvgSession),
    },
  ]

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-divider pb-8">
        <div>
          <div className="mb-3 text-[10px] tracking-[0.12em] text-accent uppercase">
            Analytics
          </div>
          <h1 className="m-0 font-heading text-[30px] font-medium tracking-tight">
            Your patterns
          </h1>
        </div>
        <div className="text-[11px] text-neutral-500">
          Last {WINDOW} days · compared with the {WINDOW} before
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
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

      <section className="mt-8 overflow-x-auto">
        <table className="table" style={{ minWidth: 680 }}>
          <thead>
            <tr>
              <th>Habit</th>
              <th className="text-right">Days</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Minutes</th>
              <th className="text-right">Avg</th>
              <th className="text-right">Streak</th>
              <th className="text-right">Change</th>
              <th className="text-right">{WINDOW} days</th>
            </tr>
          </thead>
          <tbody>
            {stats.perHabit.map((h) => (
              <tr key={h.id}>
                <td>
                  <div className="text-sm">{h.name}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    {h.target} min target
                  </div>
                </td>
                <td className="text-right">
                  {h.days}/{WINDOW}
                </td>
                <td className="text-right">{pct(h.rate)}</td>
                <td className="text-right text-neutral-400">{h.minutes}</td>
                <td className="text-right text-neutral-400">
                  {h.avg ? h.avg + 'm' : '—'}
                </td>
                <td className="text-right">{h.streak}d</td>
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
    </div>
  )
}
