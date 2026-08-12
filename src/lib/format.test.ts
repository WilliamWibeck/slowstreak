// Run: node --test src/lib/format.test.ts
//
// Only the branches money() actually owns are asserted here — the symbol,
// grouping and separator characters are Intl's business and vary by the
// machine's locale, so pinning them would test the test runner's ICU build.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currencyCodes, money } from './format.ts'

test('whole amounts drop the trailing zeros', () => {
  assert.ok(!/[.,]00\b/.test(money(1200, 'USD')), money(1200, 'USD'))
})

test('fractional amounts keep two decimals', () => {
  assert.ok(/[.,]56\b/.test(money(1200.56, 'USD')), money(1200.56, 'USD'))
})

test('the currency actually changes the output', () => {
  assert.notEqual(money(5, 'EUR'), money(5, 'USD'))
  assert.notEqual(money(5, 'SEK'), money(5, 'USD'))
})

test('an unknown code falls back instead of throwing', () => {
  assert.equal(money(5, 'not-a-currency'), 'not-a-currency 5.00')
})

test('every offered code is one money() can format', () => {
  const codes = currencyCodes()
  assert.ok(codes.includes('USD') && codes.length > 100)
  // The fallback prefixes the raw code; a formatted one never looks like that.
  for (const c of codes) assert.ok(!money(1, c).startsWith(c + ' 1.00'), c)
})
