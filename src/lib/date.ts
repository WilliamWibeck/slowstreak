export function isoLocal(d: Date): string {
  const p = (n: number) => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

/**
 * The seven dates of the Sunday-start calendar week containing `d`, GitHub's
 * layout: the week runs Sun→Sat whether or not those days have happened yet.
 *
 * Day-of-month arithmetic rather than ±86400000 so a DST boundary inside the
 * week doesn't shift a date onto its neighbour.
 */
export function calendarWeek(d: Date): Date[] {
  const sunday = d.getDate() - d.getDay()
  return Array.from(
    { length: 7 },
    (_, i) => new Date(d.getFullYear(), d.getMonth(), sunday + i),
  )
}

/**
 * Shift a date by a number of calendar days. Same day-of-month arithmetic as
 * `calendarWeek` — a DST night must not skip or duplicate a date.
 */
export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/**
 * Compact range for a Sunday–Saturday week: "Aug 9 – 15" when both ends share
 * a month, "Aug 30 – Sep 5" when they don't.
 */
export function weekRangeLabel(week: Date[]): string {
  const start = week[0]
  const end = week[6]
  if (!start || !end) return ''
  const startPart = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const endPart = end.toLocaleDateString('en-US', {
    month: start.getMonth() === end.getMonth() ? undefined : 'short',
    day: 'numeric',
  })
  return `${startPart} – ${endPart}`
}

export function ordinal(d: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = d % 100
  return d + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export function longDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function noteDateLabel(iso: string, todayISO: string): string {
  const p = iso.split('-').map(Number)
  const d = new Date(p[0]!, p[1]! - 1, p[2]!)
  const t = todayISO.split('-').map(Number)
  const today = new Date(t[0]!, t[1]! - 1, t[2]!)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
