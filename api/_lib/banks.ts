/**
 * The three accounts this dashboard imports from.
 *
 * `aspspName` and `aspspCountry` must match Enable Banking's ASPSP catalogue
 * exactly — they are the bank's registered identifiers, not free text. Look
 * yours up in the Control Panel (or `GET /aspsps`) before the first connect;
 * the names below are the expected ones but a mismatch just 404s, so they are
 * overridable from the environment rather than baked in.
 */

export type BankDef = {
  /** Stable slug. Written to expense_transactions.account — don't rename it
   *  after the first import or history splits in two. */
  slug: string
  label: string
  aspspName: string
  aspspCountry: string
}

export const BANKS: BankDef[] = [
  {
    slug: 'seb',
    label: 'SEB',
    aspspName: process.env.ASPSP_SEB_NAME || 'SEB',
    aspspCountry: process.env.ASPSP_SEB_COUNTRY || 'SE',
  },
  {
    slug: 'bank-norwegian',
    label: 'Bank Norwegian',
    aspspName: process.env.ASPSP_NORWEGIAN_NAME || 'Bank Norwegian',
    aspspCountry: process.env.ASPSP_NORWEGIAN_COUNTRY || 'SE',
  },
  {
    slug: 'amex',
    label: 'American Express',
    aspspName: process.env.ASPSP_AMEX_NAME || 'American Express',
    aspspCountry: process.env.ASPSP_AMEX_COUNTRY || 'SE',
  },
]

export function bankBySlug(slug: string): BankDef | undefined {
  return BANKS.find((b) => b.slug === slug)
}
