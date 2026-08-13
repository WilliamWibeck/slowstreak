import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseTransactionRow, HabitRow } from './database.types.ts'
import type { DayEntry, HabitSeries } from '../types.ts'
import { calendarWeek, isoLocal } from './date.ts'
import { buildWeekSummary, change } from './week-summary.ts'

function habit(over: Partial<HabitRow> = {}): HabitRow {
  return {
    id: 'h1',
    user_id: 'u',
    name: 'Read',
    goal: '',
    focus: '',
    target_minutes: 20,
    sort_order: 0,
    archived: false,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function series(minutesByIso: Record<string, number>): HabitSeries {
  const days: DayEntry[] = Object.entries(minutesByIso).map(
    ([iso, minutes]) => {
      const [y, m, d] = iso.split('-').map(Number)
      return { date: new Date(y!, m! - 1, d!), minutes, note: '' }
    },
  )
  return {
    days,
    streak: 0,
    total: days.filter((d) => d.minutes > 0).length,
    totalMin: days.reduce((a, d) => a + d.minutes, 0),
    today: days[days.length - 1] ?? {
      date: new Date(2026, 7, 13),
      minutes: 0,
      note: '',
    },
  }
}

let n = 0
function tx(over: Partial<ExpenseTransactionRow> = {}): ExpenseTransactionRow {
  n += 1
  return {
    id: `t${n}`,
    user_id: 'u',
    account: 'seb',
    bank_transaction_id: `b${n}`,
    booking_date: '2026-08-10',
    amount_sek: 100,
    original_amount: 100,
    original_currency: 'SEK',
    fx_source: 'native',
    merchant_raw: 'ICA',
    merchant_key: 'ICA',
    category: 'Food',
    category_locked: false,
    status: 'settled',
    is_transfer: false,
    created_at: '2026-08-10T00:00:00Z',
    updated_at: '2026-08-10T00:00:00Z',
    ...over,
  }
}

// Thursday 13 Aug 2026. Its week is Sun 9 – Sat 15.
const thursday = '2026-08-13'
const thisWeek = calendarWeek(new Date(2026, 7, 13))

test('change is null when the prior period was zero and this one is not', () => {
  assert.equal(change(10, 0), null)
  assert.equal(change(0, 0), 0)
  assert.equal(change(15, 10), 50)
  assert.equal(change(5, 10), -50)
})

test('a mid-week summary only counts through today, matched against last week', () => {
  const s = series({
    '2026-08-02': 20, // last Sunday
    '2026-08-03': 20,
    '2026-08-04': 20,
    '2026-08-05': 20,
    '2026-08-06': 20, // last Thursday
    '2026-08-07': 20,
    '2026-08-08': 20,
    '2026-08-09': 20, // this Sunday
    '2026-08-10': 20,
    '2026-08-11': 0,
    '2026-08-12': 20,
    '2026-08-13': 20, // today
    '2026-08-14': 20, // tomorrow — must not count
  })

  const summary = buildWeekSummary(
    thisWeek,
    thursday,
    [habit()],
    { h1: s },
    {},
    [],
  )

  assert.equal(summary.isCurrent, true)
  assert.equal(summary.elapsed, 5) // Sun–Thu
  assert.equal(summary.startISO, '2026-08-09')
  assert.equal(summary.endISO, '2026-08-15')
  assert.equal(summary.perHabit[0]?.days, 4) // missed Wednesday
  assert.equal(summary.perHabit[0]?.minutes, 80)
  // Last Sun–Thu was five logged days; Friday/Saturday of last week stay out.
  assert.equal(summary.perHabit[0]?.priorDays, 5)
  assert.equal(summary.priorDays, 5)
  assert.equal(summary.completion, 4 / 5)
  assert.equal(summary.priorCompletion, 1)
})

test('a finished week counts all seven days against the seven before', () => {
  const s = series({
    '2026-08-02': 10,
    '2026-08-09': 20,
    '2026-08-10': 20,
    '2026-08-15': 20,
  })
  const lastWeek = calendarWeek(new Date(2026, 7, 8)) // Sat 8 Aug, week Sun 2–Sat 8
  const summary = buildWeekSummary(
    lastWeek,
    thursday,
    [habit()],
    { h1: s },
    {},
    [],
  )

  assert.equal(summary.isCurrent, false)
  assert.equal(summary.elapsed, 7)
  assert.equal(summary.perHabit[0]?.days, 1)
  assert.equal(summary.perHabit[0]?.minutes, 10)
})

test('notes in the counted window are returned in date order', () => {
  const summary = buildWeekSummary(
    thisWeek,
    thursday,
    [],
    {},
    {
      '2026-08-09': 'Sunday thought',
      '2026-08-11': '  ',
      '2026-08-13': 'Thursday thought',
      '2026-08-14': 'Tomorrow — too soon',
      '2026-08-08': 'Last week',
    },
    [],
  )
  assert.deepEqual(
    summary.notes.map((n) => n.date),
    ['2026-08-09', '2026-08-13'],
  )
})

test('spend ignores transfers, nets refunds, and keeps pending visible', () => {
  const summary = buildWeekSummary(thisWeek, thursday, [], {}, {}, [
    tx({ booking_date: '2026-08-10', amount_sek: 200, category: 'Food' }),
    tx({ booking_date: '2026-08-12', amount_sek: -50, category: 'Food' }),
    tx({
      booking_date: '2026-08-13',
      amount_sek: 80,
      category: 'Food',
      status: 'pending',
    }),
    tx({
      booking_date: '2026-08-11',
      amount_sek: 5000,
      is_transfer: true,
    }),
    tx({ booking_date: '2026-08-06', amount_sek: 40, category: 'Food' }), // last Thu
    tx({ booking_date: '2026-08-14', amount_sek: 999, category: 'Food' }), // tomorrow
  ])

  assert.equal(summary.spend, 230)
  assert.equal(summary.pendingSpend, 80)
  assert.equal(summary.priorSpend, 40)
  assert.equal(summary.categories[0]?.category, 'Food')
  assert.equal(summary.categories[0]?.spent, 230)
  assert.equal(summary.categories[0]?.pending, 80)
  assert.equal(summary.categories[0]?.prior, 40)
})

test('a prior-only category still appears so a drop is visible', () => {
  const summary = buildWeekSummary(thisWeek, thursday, [], {}, {}, [
    tx({ booking_date: '2026-08-04', amount_sek: 300, category: 'Health' }),
  ])
  assert.equal(summary.spend, 0)
  assert.equal(summary.priorSpend, 300)
  assert.equal(summary.categories[0]?.category, 'Health')
  assert.equal(summary.categories[0]?.spent, 0)
  assert.equal(summary.categories[0]?.prior, 300)
})

test('completion is zero with no habits rather than NaN', () => {
  const summary = buildWeekSummary(thisWeek, thursday, [], {}, {}, [])
  assert.equal(summary.completion, 0)
  assert.equal(summary.priorCompletion, 0)
  assert.equal(summary.totalMinutes, 0)
})

test('isoLocal of the week ends match calendarWeek', () => {
  assert.equal(isoLocal(thisWeek[0]!), '2026-08-09')
  assert.equal(isoLocal(thisWeek[6]!), '2026-08-15')
})
