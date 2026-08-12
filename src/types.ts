import type { Cadence } from '@/lib/database.types'

export type View =
  'dashboard' | 'habit' | 'analytics' | 'notes' | 'expenses' | 'budget'

export type DayEntry = {
  date: Date
  minutes: number
  note: string
}

export type HabitSeries = {
  days: DayEntry[]
  streak: number
  total: number
  totalMin: number
  today: DayEntry
}

export type ThemeAccents = {
  700: string
  600: string
  base: string
  400: string
  300: string
}

export type ThemeDef = {
  id: string
  name: string
  bg: string
  surface: string
  divider: string
  empty: string
  ramp: [string, string, string, string, string]
  accents: ThemeAccents
}

/** In-flight form values for the bill dialog. */
export type BillDraft = {
  id?: string
  name: string
  amount: string
  category: string
  cadence: Cadence
  day: number
}

/** In-flight form values for the habit dialog. */
export type HabitDraft = {
  id?: string
  name: string
  goal: string
  focus: string
  target: string
}
