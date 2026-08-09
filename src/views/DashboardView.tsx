import { longDate } from '@/lib/date'
import { useTracker } from '@/state/TrackerContext'
import { HabitCard } from '@/components/HabitCard'
import { WeekGrid } from '@/components/WeekGrid'
import { YearHeatmap } from '@/components/YearHeatmap'

export function DashboardView() {
  const {
    today,
    todayISO,
    habits,
    seriesByHabit,
    notesByDate,
    noteSaved,
    setNoteAt,
    goNotes,
    newHabit,
  } = useTracker()

  let logged = 0
  let minutes = 0
  let best = 0
  for (const h of habits) {
    const s = seriesByHabit[h.id]
    if (!s) continue
    if (s.today.minutes > 0) logged++
    minutes += s.today.minutes
    if (s.streak > best) best = s.streak
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-divider pb-8">
        <div>
          <div className="mb-3 text-[10px] tracking-[0.12em] text-accent uppercase">
            Today
          </div>
          <h1 className="m-0 font-heading text-[30px] font-medium tracking-tight">
            {longDate(today)}
          </h1>
        </div>
        <div className="flex items-end gap-8">
          <div className="text-right">
            <div className="mb-2 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              Logged
            </div>
            <div className="font-heading text-2xl font-medium">
              {logged} / {habits.length}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-2 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              Minutes
            </div>
            <div className="font-heading text-2xl font-medium text-accent-300">
              {minutes}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-2 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              Best streak
            </div>
            <div className="font-heading text-2xl font-medium">{best}d</div>
          </div>
        </div>
      </header>

      {habits.length === 0 ? (
        <div className="card mt-8 items-start gap-4 p-8 shadow-sm">
          <div className="font-heading text-[17px] font-medium">
            No habits yet
          </div>
          <p className="m-0 max-w-[46ch] text-[13px] leading-relaxed text-neutral-500">
            Add the things you want to keep up with. Each one gets a daily
            minute target, a streak, and a year-long consistency map.
          </p>
          <button onClick={newHabit} className="btn btn-primary mt-2">
            Add your first habit
          </button>
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {habits.map((h) => (
              <HabitCard key={h.id} habit={h} />
            ))}
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
            <WeekGrid />
            <div className="card gap-4 p-6 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] tracking-[0.12em] text-neutral-500 uppercase">
                  Note for today
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className="text-[11px] text-accent-300"
                    style={{
                      opacity: noteSaved ? 1 : 0,
                      transition: 'opacity 300ms ease',
                    }}
                  >
                    Saved
                  </div>
                  <div
                    onClick={goNotes}
                    className="cursor-pointer text-[11px] text-neutral-500 hover:text-accent"
                  >
                    Past notes ›
                  </div>
                </div>
              </div>
              <textarea
                className="input"
                defaultValue={notesByDate[todayISO] ?? ''}
                onBlur={(e) => setNoteAt(todayISO, e.target.value)}
                placeholder="Anything worth remembering about today"
                style={{ minHeight: 132, lineHeight: 1.6, resize: 'vertical' }}
              />
            </div>
          </section>

          <section className="mt-[38px]">
            <div className="flex items-baseline justify-between pb-6">
              <h2 className="m-0 text-[11px] font-normal tracking-[0.12em] text-neutral-500 uppercase">
                Consistency · last 365 days
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                <span>less</span>
                {['900', '800', '700', '600', '500'].map((step) => (
                  <div
                    key={step}
                    className="h-[9px] w-[9px] rounded-sm"
                    style={{ background: `var(--color-accent-${step})` }}
                  />
                ))}
                <span>more</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {habits.map((h) => {
                const s = seriesByHabit[h.id]
                if (!s) return null
                return (
                  <div key={h.id} className="card min-w-0 gap-6 p-6 shadow-sm">
                    <div className="flex items-baseline justify-between">
                      <div className="font-heading text-sm font-medium">
                        {h.name}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {s.total} {s.total === 1 ? 'day' : 'days'} ·{' '}
                        {Math.round((s.total / 365) * 100)}%
                      </div>
                    </div>
                    <div className="min-w-0 max-w-full overflow-x-auto">
                      <YearHeatmap
                        days={s.days}
                        target={h.target_minutes}
                        blockSize={9}
                        blockMargin={2}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
