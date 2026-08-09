import type { Cadence } from '@/lib/database.types'

export const CATEGORIES = [
  'Housing',
  'Utilities',
  'Food',
  'Transport',
  'Health',
  'Subscriptions',
  'Other',
]

type CadenceDef = { id: Cadence; label: string; per: number }

/** `per` converts one charge at this cadence into its monthly equivalent. */
export const CADENCES: CadenceDef[] = [
  { id: 'monthly', label: 'Monthly', per: 1 },
  { id: 'quarterly', label: 'Quarterly', per: 1 / 3 },
  { id: 'yearly', label: 'Yearly', per: 1 / 12 },
]

export function cadenceById(id: string): CadenceDef {
  return CADENCES.find((c) => c.id === id) ?? CADENCES[0]!
}
