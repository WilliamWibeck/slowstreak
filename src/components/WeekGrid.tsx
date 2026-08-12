import { Fragment } from 'react'
import { themeById } from '@/data/themes'
import { calendarWeek, isoLocal } from '@/lib/date'
import { useTracker } from '@/state/TrackerContext'

const DAY_LETTERS = 'SMTWTFS'

export function WeekGrid() {
  const { today, habits, seriesByHabit, theme } = useTracker()
  const { ramp: RAMP, empty: EMPTY } = themeById(theme)

  const weekDates = calendarWeek(today)
  const todayISO = isoLocal(today)

  let weekDone = 0
  const rows = habits.map((h) => {
    // Keyed by date rather than by index: the days after today in this week
    // have no series entry at all, so positional lookup won't do.
    const minutesOn = new Map(
      (seriesByHabit[h.id]?.days ?? []).map((d) => [
        isoLocal(d.date),
        d.minutes,
      ]),
    )
    return {
      id: h.id,
      name: h.name,
      cells: weekDates.map((wd) => {
        const iso = isoLocal(wd)
        const m = minutesOn.get(iso) ?? 0
        if (m > 0) weekDone++
        return {
          title:
            wd.toDateString() +
            (m
              ? ' · ' + m + ' min'
              : iso > todayISO
                ? ' · upcoming'
                : ' · nothing logged'),
          color:
            m > 0
              ? RAMP[
                  Math.min(
                    4,
                    Math.floor(Math.min(1, m / h.target_minutes) * 4.99),
                  )
                ]
              : EMPTY,
        }
      }),
    }
  })

  return (
    <div className="card gap-6 p-6 shadow-sm">
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] tracking-[0.12em] text-neutral-500 uppercase">
          This week
        </div>
        <div className="text-[11px] text-neutral-500">
          {weekDone} of {habits.length * 7} logged
        </div>
      </div>
      <div
        className="grid min-w-0 items-center gap-2 overflow-x-auto"
        style={{ gridTemplateColumns: '86px repeat(7, minmax(30px, 1fr))' }}
      >
        <div />
        {weekDates.map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] tracking-[0.06em]"
            style={{
              color:
                isoLocal(d) === todayISO
                  ? 'var(--color-accent)'
                  : 'var(--color-neutral-600)',
            }}
          >
            {DAY_LETTERS[d.getDay()]}
          </div>
        ))}
        {rows.map((r) => (
          <Fragment key={r.id}>
            <div className="truncate text-xs text-neutral-400">{r.name}</div>
            {r.cells.map((c, i) => (
              <div
                key={i}
                title={c.title}
                className="h-[26px] rounded-sm"
                style={{ background: c.color }}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
