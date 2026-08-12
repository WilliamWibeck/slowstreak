// Run: node --test src/lib/calendar.test.ts
//
// The GitHub-shaped week layout: a calendar week is always Sun→Sat, and a
// series ending mid-week gets its remaining days back as empty ones.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarWeek, isoLocal } from './date.ts'
import { padToWeekEnd } from './series.ts'
import type { DayEntry } from '../types.ts'

const day = (iso: string): DayEntry => {
  const [y, m, d] = iso.split('-').map(Number)
  return { date: new Date(y!, m! - 1, d!), minutes: 30, note: '' }
}

test('a calendar week runs Sunday to Saturday around any day in it', () => {
  // 2026-08-10 is a Monday; its week is Sun 09-08 through Sat 15-08.
  const week = calendarWeek(new Date(2026, 7, 10)).map(isoLocal)
  assert.deepEqual(week, [
    '2026-08-09',
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
    '2026-08-14',
    '2026-08-15',
  ])
})

test('the same week comes back whichever of its days you ask with', () => {
  const fromMonday = calendarWeek(new Date(2026, 7, 10)).map(isoLocal)
  for (const d of [9, 11, 15]) {
    assert.deepEqual(calendarWeek(new Date(2026, 7, d)).map(isoLocal), fromMonday)
  }
})

test('a week spanning a month boundary still holds seven days', () => {
  const week = calendarWeek(new Date(2026, 7, 31)).map(isoLocal)
  assert.equal(week.length, 7)
  assert.equal(week[0], '2026-08-30')
  assert.equal(week[6], '2026-09-05')
})

test('padToWeekEnd fills to Saturday with empty days', () => {
  const padded = padToWeekEnd([day('2026-08-09'), day('2026-08-10')])
  assert.deepEqual(padded.map((d) => isoLocal(d.date)).slice(2), [
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
    '2026-08-14',
    '2026-08-15',
  ])
  // Padding is "not logged", not "logged zero" — same shape as an empty day.
  assert.ok(padded.slice(2).every((d) => d.minutes === 0 && d.note === ''))
})

test('padToWeekEnd leaves a week that already ends on Saturday alone', () => {
  const days = [day('2026-08-14'), day('2026-08-15')]
  assert.equal(padToWeekEnd(days).length, 2)
})

test('padded length is always a whole number of weeks off the start', () => {
  // What react-activity-calendar needs: a full trailing column.
  for (let d = 9; d <= 15; d++) {
    const padded = padToWeekEnd([day('2026-08-09'), ...[day(`2026-08-${d}`)]])
    assert.equal(isoLocal(padded[padded.length - 1]!.date), '2026-08-15')
  }
})

test('padToWeekEnd on an empty list is a no-op', () => {
  assert.deepEqual(padToWeekEnd([]), [])
})
