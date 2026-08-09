import type { DayEntry, HabitSeries } from '@/types'
import type { EntryRow } from '@/lib/database.types'
import { isoLocal } from '@/lib/date'

export const WINDOW_DAYS = 365

/** First day of the rolling window, as a local ISO date. */
export function windowStart(today: Date): string {
  return isoLocal(new Date(today.getTime() - (WINDOW_DAYS - 1) * 86400000))
}

/**
 * Builds one habit's rolling 365-day view from its stored entries. Days with
 * no row are treated as zero-minute misses, so the heatmap stays a fixed
 * width regardless of how much history exists.
 */
export function buildSeries(
  habitId: string,
  entries: EntryRow[],
  today: Date,
): HabitSeries {
  const byDate = new Map<string, EntryRow>()
  for (const e of entries) {
    if (e.habit_id === habitId) byDate.set(e.entry_date, e)
  }

  const days: DayEntry[] = []
  let total = 0
  let totalMin = 0

  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86400000)
    const row = byDate.get(isoLocal(date))
    const minutes = row?.minutes ?? 0
    if (minutes > 0) {
      total++
      totalMin += minutes
    }
    days.push({ date, minutes, note: row?.note ?? '' })
  }

  return {
    days,
    streak: currentStreak(days),
    total,
    totalMin,
    today: days[days.length - 1]!,
  }
}

/**
 * Consecutive logged days ending now. Today counts only once logged, but an
 * unlogged today does not break the streak — you have until midnight, so a
 * streak dies on a fully missed day, not on a morning that hasn't happened yet.
 */
function currentStreak(days: DayEntry[]): number {
  let i = days.length - 1
  if (i >= 0 && days[i]!.minutes === 0) i-- // today still pending
  let streak = 0
  for (; i >= 0; i--) {
    if (days[i]!.minutes > 0) streak++
    else break
  }
  return streak
}
