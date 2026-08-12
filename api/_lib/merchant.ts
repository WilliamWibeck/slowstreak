import type { EbTransaction } from './enablebanking'

/**
 * The raw bank text for a transaction, untouched.
 *
 * Stored as-is and never overwritten: the categoriser gets things wrong and
 * needs correcting, and you can only re-run a corrected categoriser against
 * text that still says what the bank said.
 */
export function merchantRaw(tx: EbTransaction): string {
  const counterparty =
    tx.credit_debit_indicator === 'CRDT' ? tx.debtor?.name : tx.creditor?.name
  const remittance = (tx.remittance_information ?? []).join(' ').trim()
  return (counterparty?.trim() || remittance || 'Unknown').slice(0, 300)
}

/**
 * The cache key the categoriser is memoised on.
 *
 * Card terminals append a store number, a city, a date, a sequence — so the
 * same shop arrives as a dozen distinct strings. Stripping digits and
 * punctuation collapses them onto one key, which is what stops the LLM being
 * asked about ICA forty times.
 *
 *   'ICA SUPERMARKET SOLNA 4711'  → 'ICA SUPERMARKET SOLNA'
 *   'Ica  Supermarket  Solna/338' → 'ICA SUPERMARKET SOLNA'
 */
export function merchantKey(raw: string): string {
  return (
    raw
      .toUpperCase()
      .replace(/[^A-Z0-9ÅÄÖ\s]/g, ' ')
      // Drop bare number groups (store ids, dates, terminal sequences) but keep
      // digits fused into a name, so "7-ELEVEN" survives as "7 ELEVEN".
      .replace(/\b\d+\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)
  )
}
