/**
 * The spend categories shared by the bills page, the budget page and the
 * importer's categoriser.
 *
 * Deliberately import-free so the Vercel functions under `api/` can pull it in
 * with a plain relative import — they build outside the app's `@/` alias.
 */

export const CATEGORIES = [
  'Housing',
  'Utilities',
  'Food',
  'Transport',
  'Health',
  'Subscriptions',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number] | typeof UNCATEGORIZED

/**
 * Where a transaction sits before anything has classified it — a keyword miss
 * with the LLM unavailable, or a merchant awaiting a rule. Kept out of
 * CATEGORIES so it never shows up as a target you can budget against.
 */
export const UNCATEGORIZED = 'Uncategorized'

/** Transfers between the owner's own accounts. Never counted as spend. */
export const TRANSFER = 'Transfer'
