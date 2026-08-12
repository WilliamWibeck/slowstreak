import { ActivityCalendar } from 'react-activity-calendar'
import type { DayEntry } from '@/types'
import { isoLocal } from '@/lib/date'
import { padToWeekEnd } from '@/lib/series'
import { themeById } from '@/data/themes'
import { useTracker } from '@/state/TrackerContext'

// Level 0 is a day with nothing logged; 1-5 grade how close the day came to
// the habit's target.
function levelFor(minutes: number, target: number): number {
  if (minutes <= 0) return 0
  return 1 + Math.min(4, Math.floor(Math.min(1, minutes / target) * 4.99))
}

export function YearHeatmap({
  days,
  target,
  blockSize,
  blockMargin,
}: {
  days: DayEntry[]
  target: number
  blockSize: number
  blockMargin: number
}) {
  const { theme } = useTracker()
  const t = themeById(theme)

  // Complete the current week so the final column is full height, the way
  // GitHub's contribution graph renders the days still to come.
  const shown = padToWeekEnd(days)
  const todayISO = isoLocal(days[days.length - 1]?.date ?? new Date())

  const data = shown.map((d) => ({
    date: isoLocal(d.date),
    count: d.minutes,
    level: levelFor(d.minutes, target),
  }))
  const noteByDate = new Map(shown.map((d) => [isoLocal(d.date), d.note]))

  return (
    <ActivityCalendar
      data={data}
      colorScheme="dark"
      theme={{ dark: [t.empty, ...t.ramp] }}
      minLevel={0}
      maxLevel={5}
      blockSize={blockSize}
      blockMargin={blockMargin}
      blockRadius={2}
      showMonthLabels={false}
      showWeekdayLabels={false}
      showColorLegend={false}
      showTotalCount={false}
      tooltips={{
        activity: {
          text: (a) => {
            const d = new Date(a.date + 'T00:00:00')
            const note = noteByDate.get(a.date)
            if (a.date > todayISO) return d.toDateString() + ' · upcoming'
            return (
              d.toDateString() +
              (a.count
                ? ' · ' + a.count + ' min' + (note ? ' · ' + note : '')
                : ' · nothing logged')
            )
          },
        },
      }}
    />
  )
}
