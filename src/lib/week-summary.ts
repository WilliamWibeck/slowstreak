import type { ExpenseTransactionRow, HabitRow } from './database.types.ts'
import type { HabitSeries } from '../types.ts'
import type { SparkBar } from './sparkline.ts'
import { spendable } from './budget.ts'
import { addDays, calendarWeek, isoLocal } from './date.ts'

/**
 * One Sunday–Saturday week of habits, notes and spend, compared with the
 * matching slice of the week before.
 *
 * For the week that still contains today, only days through today are
 * counted — and the prior week is sliced to the same weekdays, so Thursday
 * is compared with last Thursday rather than with a full seven days.
 */

export type WeekHabitStat = {
  id: string
  name: string
  target: number
  days: number
  priorDays: number
  minutes: number
  priorMinutes: number
  rate: number
  avg: number
  spark: SparkBar[]
}

export type WeekNote = {
  date: string
  body: string
}

export type WeekCategorySpend = {
  category: string
  spent: number
  prior: number
  pending: number
}

export type WeekSummary = {
  startISO: string
  endISO: string
  /** Days that count: 1–7, always ending at today when this is the live week. */
  elapsed: number
  isCurrent: boolean
  perHabit: WeekHabitStat[]
  totalMinutes: number
  priorMinutes: number
  totalDays: number
  priorDays: number
  completion: number
  priorCompletion: number
  notes: WeekNote[]
  spend: number
  priorSpend: number
  pendingSpend: number
  categories: WeekCategorySpend[]
}

/** Signed percentage change, or null when there's no prior period to compare. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Days of `week` that have already happened, inclusive of today. */
export function elapsedDays(week: Date[], todayISO: string): Date[] {
  return week.filter((d) => isoLocal(d) <= todayISO)
}

function minutesByIso(series: HabitSeries | undefined): Map<string, number> {
  const out = new Map<string, number>()
  if (!series) return out
  for (const d of series.days) out.set(isoLocal(d.date), d.minutes)
  return out
}

function tally(
  dates: Date[],
  byIso: Map<string, number>,
): { hits: number; minutes: number } {
  let hits = 0
  let minutes = 0
  for (const d of dates) {
    const m = byIso.get(isoLocal(d)) ?? 0
    if (m > 0) hits++
    minutes += m
  }
  return { hits, minutes }
}

function spendOn(
  transactions: ExpenseTransactionRow[],
  dates: Date[],
): {
  total: number
  pending: number
  byCategory: Map<string, number>
  pendingByCategory: Map<string, number>
} {
  const wanted = new Set(dates.map(isoLocal))
  const byCategory = new Map<string, number>()
  const pendingByCategory = new Map<string, number>()
  let total = 0
  let pending = 0
  for (const tx of spendable(transactions)) {
    if (!wanted.has(tx.booking_date)) continue
    const amount = Number(tx.amount_sek)
    total += amount
    byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + amount)
    if (tx.status === 'pending') {
      pending += amount
      pendingByCategory.set(
        tx.category,
        (pendingByCategory.get(tx.category) ?? 0) + amount,
      )
    }
  }
  return {
    total: round2(total),
    pending: round2(pending),
    byCategory,
    pendingByCategory,
  }
}

export function buildWeekSummary(
  week: Date[],
  todayISO: string,
  habits: HabitRow[],
  seriesByHabit: Record<string, HabitSeries>,
  notesByDate: Record<string, string>,
  transactions: ExpenseTransactionRow[],
): WeekSummary {
  const sunday = week[0]
  const saturday = week[6]
  if (!sunday || !saturday) {
    throw new Error('buildWeekSummary expects a seven-day Sunday–Saturday week')
  }

  const counted = elapsedDays(week, todayISO)
  const priorWeek = calendarWeek(addDays(sunday, -7))
  const priorCounted = priorWeek.slice(0, counted.length)
  const isCurrent = week.some((d) => isoLocal(d) === todayISO)

  const perHabit = habits.map((h) => {
    const byIso = minutesByIso(seriesByHabit[h.id])
    const recent = tally(counted, byIso)
    const prior = tally(priorCounted, byIso)
    const window = counted.length || 1
    return {
      id: h.id,
      name: h.name,
      target: h.target_minutes,
      days: recent.hits,
      priorDays: prior.hits,
      minutes: recent.minutes,
      priorMinutes: prior.minutes,
      rate: recent.hits / window,
      avg: recent.hits ? Math.round(recent.minutes / recent.hits) : 0,
      spark: week.map((d) => {
        const iso = isoLocal(d)
        const m = iso > todayISO ? 0 : (byIso.get(iso) ?? 0)
        return {
          heightPct: Math.max(
            2,
            Math.min(100, (m / Math.max(1, h.target_minutes)) * 100),
          ),
        }
      }),
    }
  })

  const totalMinutes = perHabit.reduce((a, h) => a + h.minutes, 0)
  const priorMinutes = perHabit.reduce((a, h) => a + h.priorMinutes, 0)
  const totalDays = perHabit.reduce((a, h) => a + h.days, 0)
  const priorDays = perHabit.reduce((a, h) => a + h.priorDays, 0)
  const possible = habits.length * counted.length
  const priorPossible = habits.length * priorCounted.length

  const notes: WeekNote[] = []
  for (const d of counted) {
    const date = isoLocal(d)
    const body = notesByDate[date]?.trim()
    if (body) notes.push({ date, body })
  }

  const currentSpend = spendOn(transactions, counted)
  const priorSpend = spendOn(transactions, priorCounted)
  const categories = new Map<string, WeekCategorySpend>()
  for (const [category, spent] of currentSpend.byCategory) {
    categories.set(category, {
      category,
      spent: round2(spent),
      prior: 0,
      pending: round2(currentSpend.pendingByCategory.get(category) ?? 0),
    })
  }
  for (const [category, spent] of priorSpend.byCategory) {
    const row = categories.get(category)
    if (row) row.prior = round2(spent)
    else {
      categories.set(category, {
        category,
        spent: 0,
        prior: round2(spent),
        pending: 0,
      })
    }
  }

  return {
    startISO: isoLocal(sunday),
    endISO: isoLocal(saturday),
    elapsed: counted.length,
    isCurrent,
    perHabit,
    totalMinutes,
    priorMinutes,
    totalDays,
    priorDays,
    completion: possible ? totalDays / possible : 0,
    priorCompletion: priorPossible ? priorDays / priorPossible : 0,
    notes,
    spend: currentSpend.total,
    priorSpend: priorSpend.total,
    pendingSpend: currentSpend.pending,
    categories: [...categories.values()].sort(
      (a, b) => b.spent - a.spent || a.category.localeCompare(b.category),
    ),
  }
}
