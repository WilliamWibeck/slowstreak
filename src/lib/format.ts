/**
 * Trailing ".00" is dropped so whole amounts read as "$1,200" — the rest
 * (symbol, placement, grouping, how many decimals the currency even has) is
 * Intl's problem, which is why there is no symbol table here.
 *
 * Unknown codes make Intl throw; fall back to the raw code rather than taking
 * the expenses page down over a bad settings row.
 */
export function money(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return currency + ' ' + n.toFixed(2)
  }
}

/** ISO 4217 codes the runtime can actually format. */
export function currencyCodes(): string[] {
  return Intl.supportedValuesOf('currency')
}

export function fmt(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}
