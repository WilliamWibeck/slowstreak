import { supabase } from '@/lib/supabase'
import type {
  BillRow,
  Cadence,
  EntryRow,
  HabitRow,
  JournalNoteRow,
  UserSettingsRow,
} from '@/lib/database.types'

// Supabase returns { data, error }; every helper here throws on error so
// TanStack Query can route failures into its error state.
function unwrap<T>({
  data,
  error,
}: {
  data: T | null
  error: { message: string } | null
}): T {
  if (error) throw new Error(error.message)
  return data as T
}

// ── habits ───────────────────────────────────────────────────────────────

export async function fetchHabits(): Promise<HabitRow[]> {
  return unwrap(
    await supabase
      .from('habits')
      .select('*')
      .eq('archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  )
}

export async function createHabit(input: {
  userId: string
  name: string
  goal: string
  focus: string
  targetMinutes: number
  sortOrder: number
}): Promise<HabitRow> {
  return unwrap(
    await supabase
      .from('habits')
      .insert({
        user_id: input.userId,
        name: input.name,
        goal: input.goal,
        focus: input.focus,
        target_minutes: input.targetMinutes,
        sort_order: input.sortOrder,
        archived: false,
      })
      .select()
      .single(),
  )
}

export async function updateHabit(
  id: string,
  patch: Partial<
    Pick<HabitRow, 'name' | 'goal' | 'focus' | 'target_minutes' | 'sort_order'>
  >,
): Promise<HabitRow> {
  return unwrap(
    await supabase.from('habits').update(patch).eq('id', id).select().single(),
  )
}

// Soft delete: archiving keeps the historical entries intact and out of the way.
export async function archiveHabit(id: string): Promise<void> {
  const { error } = await supabase
    .from('habits')
    .update({ archived: true })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── entries ──────────────────────────────────────────────────────────────

export async function fetchEntries(
  fromISO: string,
  toISO: string,
): Promise<EntryRow[]> {
  return unwrap(
    await supabase
      .from('entries')
      .select('*')
      .gte('entry_date', fromISO)
      .lte('entry_date', toISO)
      .order('entry_date', { ascending: true }),
  )
}

// One row per (habit, day) — upsert on that unique pair so toggling a day
// repeatedly updates in place instead of piling up rows.
export async function upsertEntry(input: {
  userId: string
  habitId: string
  date: string
  minutes: number
  note: string
}): Promise<EntryRow> {
  return unwrap(
    await supabase
      .from('entries')
      .upsert(
        {
          user_id: input.userId,
          habit_id: input.habitId,
          entry_date: input.date,
          minutes: input.minutes,
          note: input.note,
        },
        { onConflict: 'habit_id,entry_date' },
      )
      .select()
      .single(),
  )
}

// ── journal ──────────────────────────────────────────────────────────────

export async function fetchNotes(): Promise<JournalNoteRow[]> {
  return unwrap(
    await supabase
      .from('journal_notes')
      .select('*')
      .order('note_date', { ascending: false }),
  )
}

export async function upsertNote(input: {
  userId: string
  date: string
  body: string
}): Promise<JournalNoteRow> {
  return unwrap(
    await supabase
      .from('journal_notes')
      .upsert(
        { user_id: input.userId, note_date: input.date, body: input.body },
        { onConflict: 'user_id,note_date' },
      )
      .select()
      .single(),
  )
}

// ── bills ────────────────────────────────────────────────────────────────

export async function fetchBills(): Promise<BillRow[]> {
  return unwrap(
    await supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: true }),
  )
}

export async function saveBill(input: {
  id?: string
  userId: string
  name: string
  amount: number
  category: string
  cadence: Cadence
  dueDay: number
}): Promise<BillRow> {
  // user_id is set once on insert and never reassigned, so it stays out of the
  // update payload (RLS would reject a change anyway).
  const fields = {
    name: input.name,
    amount: input.amount,
    category: input.category,
    cadence: input.cadence,
    due_day: input.dueDay,
  }
  if (input.id) {
    return unwrap(
      await supabase
        .from('bills')
        .update(fields)
        .eq('id', input.id)
        .select()
        .single(),
    )
  }
  return unwrap(
    await supabase
      .from('bills')
      .insert({ user_id: input.userId, ...fields })
      .select()
      .single(),
  )
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from('bills').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── settings ─────────────────────────────────────────────────────────────

export async function fetchSettings(userId: string): Promise<UserSettingsRow> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return data
  // The new-user trigger normally creates this row; self-heal if it's missing
  // (e.g. an account made before the trigger existed).
  return unwrap(
    await supabase
      .from('user_settings')
      .insert({ user_id: userId })
      .select()
      .single(),
  )
}

export async function updateSettings(
  userId: string,
  patch: Partial<Pick<UserSettingsRow, 'theme'>>,
): Promise<UserSettingsRow> {
  return unwrap(
    await supabase
      .from('user_settings')
      .update(patch)
      .eq('user_id', userId)
      .select()
      .single(),
  )
}
