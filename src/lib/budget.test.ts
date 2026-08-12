import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseTransactionRow } from './database.types.ts'
import {
  fillPct,
  monthKey,
  monthTotal,
  monthlyTrend,
  spendByCategory,
} from './budget.ts'

let n = 0
function tx(over: Partial<ExpenseTransactionRow> = {}): ExpenseTransactionRow {
  n += 1
  return {
    id: `t${n}`,
    user_id: 'u',
    account: 'seb',
    bank_transaction_id: `b${n}`,
    booking_date: '2026-08-04',
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
    created_at: '2026-08-04T00:00:00Z',
    updated_at: '2026-08-04T00:00:00Z',
    ...over,
  }
}

test('monthKey uses local time, not UTC', () => {
  // 1 Jan 00:30 local in a positive-offset zone is still December in UTC.
  assert.equal(monthKey(new Date(2026, 0, 1, 0, 30)), '2026-01')
  assert.equal(monthKey(new Date(2026, 11, 31, 23, 30)), '2026-12')
})

test('refunds net out within their category', () => {
  const rows = [
    tx({ amount_sek: 500, category: 'Food' }),
    tx({ amount_sek: -120, category: 'Food' }),
  ]
  const [food] = spendByCategory(rows, '2026-08', {})
  assert.equal(food?.spent, 380)
})

test('transfers are excluded from spend', () => {
  const rows = [
    tx({ amount_sek: 200, category: 'Food' }),
    tx({ amount_sek: 5000, category: 'Transfer', is_transfer: true }),
  ]
  assert.equal(monthTotal(rows, '2026-08'), 200)
  assert.deepEqual(
    spendByCategory(rows, '2026-08', {}).map((c) => c.category),
    ['Food'],
  )
})

test('pending is counted in spent and reported separately', () => {
  const rows = [
    tx({ amount_sek: 300, category: 'Food', status: 'settled' }),
    tx({ amount_sek: 90, category: 'Food', status: 'pending' }),
  ]
  const [food] = spendByCategory(rows, '2026-08', {})
  assert.equal(food?.spent, 390)
  assert.equal(food?.pending, 90)
})

test('a category with a target but no spend still shows up', () => {
  const rows = [tx({ amount_sek: 200, category: 'Food' })]
  const cats = spendByCategory(rows, '2026-08', { Food: 4000, Health: 500 })
  const health = cats.find((c) => c.category === 'Health')
  assert.equal(health?.spent, 0)
  assert.equal(health?.target, 500)
})

test('only the requested month is counted', () => {
  const rows = [
    tx({ booking_date: '2026-07-31', amount_sek: 999 }),
    tx({ booking_date: '2026-08-01', amount_sek: 10 }),
  ]
  assert.equal(monthTotal(rows, '2026-08'), 10)
})

test('trend emits a zero row for months with no transactions', () => {
  const rows = [tx({ booking_date: '2026-08-04', amount_sek: 250 })]
  const trend = monthlyTrend(rows, new Date(2026, 7, 12), 6)

  assert.equal(trend.length, 6)
  assert.equal(trend[0]?.month, '2026-03')
  assert.equal(trend[5]?.month, '2026-08')
  assert.equal(trend[5]?.total, 250)
  assert.equal(trend[4]?.total, 0)
})

test('trend does not skip a month when today is the 31st', () => {
  // Naive month arithmetic from the 31st lands on 1 March and drops February.
  const trend = monthlyTrend([], new Date(2026, 4, 31), 3)
  assert.deepEqual(
    trend.map((m) => m.month),
    ['2026-03', '2026-04', '2026-05'],
  )
})

test('fillPct clamps and tolerates a missing target', () => {
  assert.equal(fillPct(500, 1000), 50)
  assert.equal(fillPct(2000, 1000), 100)
  assert.equal(fillPct(-50, 1000), 0)
  assert.equal(fillPct(500, null), 0)
  assert.equal(fillPct(500, 0), 0)
})
