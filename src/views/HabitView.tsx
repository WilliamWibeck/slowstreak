import { useTracker } from '@/state/TrackerContext'
import { YearHeatmap } from '@/components/YearHeatmap'

export function HabitView() {
  const {
    selected,
    habits,
    seriesByHabit,
    openLogModal,
    goDashboard,
    editHabit,
  } = useTracker()
  const habit = habits.find((h) => h.id === selected)

  if (!habit) {
    return (
      <div>
        <button onClick={goDashboard} className="btn btn-ghost mb-6 text-xs">
          ‹ Dashboard
        </button>
        <div className="text-[13px] text-neutral-500">
          That habit no longer exists.
        </div>
      </div>
    )
  }

  const s = seriesByHabit[habit.id]
  const days = s?.days ?? []
  const done30 = days
    .slice(-30)
    .reduce((a, d) => a + (d.minutes > 0 ? 1 : 0), 0)
  const logged = days.filter((d) => d.minutes > 0)

  const stats = [
    { label: 'Current streak', value: (s?.streak ?? 0) + 'd' },
    { label: 'Last 30 days', value: done30 + '/30' },
    { label: 'Total hours', value: Math.round((s?.totalMin ?? 0) / 60) + 'h' },
    {
      label: 'Avg session',
      value: logged.length
        ? Math.round((s?.totalMin ?? 0) / logged.length) + ' min'
        : '—',
    },
  ]

  // Most recent days that actually have something recorded.
  const recent = days
    .filter((d) => d.minutes > 0 || d.note)
    .slice(-12)
    .reverse()

  return (
    <div>
      <button onClick={goDashboard} className="btn btn-ghost mb-6 text-xs">
        ‹ Dashboard
      </button>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-divider pb-8">
        <div>
          <h1 className="m-0 font-heading text-[34px] font-medium tracking-tight">
            {habit.name}
          </h1>
          <div className="mt-3 text-xs text-neutral-500">
            {habit.goal || `Target ${habit.target_minutes} min`}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => editHabit(habit.id)}
            className="btn btn-secondary"
          >
            Edit
          </button>
          <button
            onClick={() => openLogModal(habit.id)}
            className="btn btn-primary"
          >
            Log entry
          </button>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className="card gap-2 p-6 shadow-sm">
            <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              {st.label}
            </div>
            <div className="mt-2 font-heading text-[27px] font-medium">
              {st.value}
            </div>
          </div>
        ))}
      </section>

      <section className="card mt-4 min-w-0 gap-6 p-8 shadow-sm">
        <div className="text-[10px] tracking-[0.12em] text-neutral-500 uppercase">
          Last 365 days
        </div>
        <div className="min-w-0 max-w-full overflow-x-auto">
          <YearHeatmap
            days={days}
            target={habit.target_minutes}
            blockSize={13}
            blockMargin={3}
          />
        </div>
      </section>

      <section className="mt-[38px]">
        <h2 className="m-0 mb-4 text-[11px] font-normal tracking-[0.12em] text-neutral-500 uppercase">
          Recent entries
        </h2>
        <div className="card gap-0 px-6 pt-2 pb-4 shadow-sm">
          {recent.length === 0 && (
            <div className="py-6 text-[13px] text-neutral-600">
              Nothing logged yet. Use “Log entry” above, or click the card on
              the dashboard.
            </div>
          )}
          {recent.map((r, i) => (
            <div
              key={i}
              className="grid items-center gap-4 border-b border-divider py-4"
              style={{ gridTemplateColumns: 'minmax(100px, 150px) 80px 1fr' }}
            >
              <div className="text-xs text-neutral-400">
                {r.date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div
                className="text-[13px]"
                style={{
                  color: r.minutes
                    ? 'var(--color-accent-300)'
                    : 'var(--color-neutral-600)',
                }}
              >
                {r.minutes ? r.minutes + ' min' : '—'}
              </div>
              <div className="text-[13px] text-neutral-400">
                {r.note || 'No note'}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
