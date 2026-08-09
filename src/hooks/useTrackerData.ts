import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  BillRow,
  Cadence,
  EntryRow,
  HabitRow,
  JournalNoteRow,
} from '@/lib/database.types'
import type { HabitSeries } from '@/types'
import { useAuth } from '@/auth/AuthProvider'
import { isoLocal } from '@/lib/date'
import { buildSeries, windowStart } from '@/lib/series'
import * as api from '@/api/queries'

export const keys = {
  habits: ['habits'] as const,
  entries: (from: string, to: string) => ['entries', from, to] as const,
  notes: ['notes'] as const,
  bills: ['bills'] as const,
  settings: (userId: string) => ['settings', userId] as const,
}

/** Today, recomputed per render but stable in value for the whole session. */
export function useToday(): { today: Date; todayISO: string; from: string } {
  return useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return { today, todayISO: isoLocal(today), from: windowStart(today) }
  }, [])
}

export function useHabits() {
  return useQuery({ queryKey: keys.habits, queryFn: api.fetchHabits })
}

export function useEntries(from: string, to: string) {
  return useQuery({
    queryKey: keys.entries(from, to),
    queryFn: () => api.fetchEntries(from, to),
  })
}

/** Per-habit rolling window, keyed by habit id. */
export function useSeries(
  habits: HabitRow[],
  entries: EntryRow[],
  today: Date,
) {
  return useMemo(() => {
    const out: Record<string, HabitSeries> = {}
    for (const h of habits) out[h.id] = buildSeries(h.id, entries, today)
    return out
  }, [habits, entries, today])
}

// ── mutations ────────────────────────────────────────────────────────────
// Each writes through optimistically so toggling a habit feels instant, then
// reconciles against what the database actually stored.

export function useUpsertEntry(from: string, to: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const key = keys.entries(from, to)

  return useMutation({
    mutationFn: (v: {
      habitId: string
      date: string
      minutes: number
      note: string
    }) => api.upsertEntry({ userId: user!.id, ...v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<EntryRow[]>(key) ?? []
      const optimistic: EntryRow = {
        id: `optimistic-${v.habitId}-${v.date}`,
        user_id: user!.id,
        habit_id: v.habitId,
        entry_date: v.date,
        minutes: v.minutes,
        note: v.note,
        updated_at: new Date().toISOString(),
      }
      const existing = prev.find(
        (e) => e.habit_id === v.habitId && e.entry_date === v.date,
      )
      qc.setQueryData<EntryRow[]>(
        key,
        existing
          ? prev.map((e) =>
              e === existing ? { ...e, minutes: v.minutes, note: v.note } : e,
            )
          : [...prev, optimistic],
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useNotes() {
  return useQuery({ queryKey: keys.notes, queryFn: api.fetchNotes })
}

export function useUpsertNote() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (v: { date: string; body: string }) =>
      api.upsertNote({ userId: user!.id, ...v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.notes })
      const prev = qc.getQueryData<JournalNoteRow[]>(keys.notes) ?? []
      const existing = prev.find((n) => n.note_date === v.date)
      qc.setQueryData<JournalNoteRow[]>(
        keys.notes,
        existing
          ? prev.map((n) => (n === existing ? { ...n, body: v.body } : n))
          : [
              {
                id: `optimistic-${v.date}`,
                user_id: user!.id,
                note_date: v.date,
                body: v.body,
                updated_at: new Date().toISOString(),
              },
              ...prev,
            ],
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(keys.notes, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.notes }),
  })
}

export function useBills() {
  return useQuery({ queryKey: keys.bills, queryFn: api.fetchBills })
}

export function useSaveBill() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (v: {
      id?: string
      name: string
      amount: number
      category: string
      cadence: Cadence
      dueDay: number
    }) => api.saveBill({ userId: user!.id, ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bills }),
  })
}

export function useDeleteBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteBill(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.bills })
      const prev = qc.getQueryData<BillRow[]>(keys.bills) ?? []
      qc.setQueryData<BillRow[]>(
        keys.bills,
        prev.filter((b) => b.id !== id),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(keys.bills, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.bills }),
  })
}

export function useSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: keys.settings(user?.id ?? 'anon'),
    queryFn: () => api.fetchSettings(user!.id),
    enabled: !!user,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (patch: { theme?: string }) => api.updateSettings(user!.id, patch),
    onSuccess: (row) => qc.setQueryData(keys.settings(user!.id), row),
  })
}

// ── habit CRUD ───────────────────────────────────────────────────────────

export function useSaveHabit() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (v: {
      id?: string
      name: string
      goal: string
      focus: string
      targetMinutes: number
      sortOrder: number
    }) =>
      v.id
        ? api.updateHabit(v.id, {
            name: v.name,
            goal: v.goal,
            focus: v.focus,
            target_minutes: v.targetMinutes,
          })
        : api.createHabit({ userId: user!.id, ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.habits }),
  })
}

export function useArchiveHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.archiveHabit(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.habits })
      const prev = qc.getQueryData<HabitRow[]>(keys.habits) ?? []
      qc.setQueryData<HabitRow[]>(
        keys.habits,
        prev.filter((h) => h.id !== id),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(keys.habits, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.habits }),
  })
}
