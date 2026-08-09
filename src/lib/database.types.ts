// Shape of the Postgres schema defined in supabase/migrations/0001_init.sql.
// Hand-written rather than generated so it stays readable; if you install the
// Supabase CLI you can regenerate it with:
//   supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Cadence = 'monthly' | 'quarterly' | 'yearly'

export type HabitRow = {
  id: string
  user_id: string
  name: string
  goal: string
  /** Optional "what specifically, right now" line — a book, a training block. */
  focus: string
  target_minutes: number
  sort_order: number
  archived: boolean
  created_at: string
}

export type EntryRow = {
  id: string
  user_id: string
  habit_id: string
  entry_date: string
  minutes: number
  note: string
  updated_at: string
}

export type JournalNoteRow = {
  id: string
  user_id: string
  note_date: string
  body: string
  updated_at: string
}

export type BillRow = {
  id: string
  user_id: string
  name: string
  amount: number
  category: string
  cadence: Cadence
  due_day: number
  created_at: string
}

export type UserSettingsRow = {
  user_id: string
  theme: string
  updated_at: string
}

// Shape required by supabase-js: every table carries Row/Insert/Update plus a
// Relationships array, and the schema needs Views/Functions even when empty.
export type Database = {
  public: {
    Tables: {
      habits: {
        Row: HabitRow
        // Only user_id and name lack a SQL default.
        Insert: Pick<HabitRow, 'user_id' | 'name'> &
          Partial<Omit<HabitRow, 'user_id' | 'name'>>
        Update: Partial<Omit<HabitRow, 'id' | 'user_id'>>
        Relationships: []
      }
      entries: {
        Row: EntryRow
        Insert: Pick<EntryRow, 'user_id' | 'habit_id' | 'entry_date'> &
          Partial<Omit<EntryRow, 'user_id' | 'habit_id' | 'entry_date'>>
        Update: Partial<Omit<EntryRow, 'id' | 'user_id'>>
        Relationships: []
      }
      journal_notes: {
        Row: JournalNoteRow
        Insert: Pick<JournalNoteRow, 'user_id' | 'note_date'> &
          Partial<Omit<JournalNoteRow, 'user_id' | 'note_date'>>
        Update: Partial<Omit<JournalNoteRow, 'id' | 'user_id'>>
        Relationships: []
      }
      bills: {
        Row: BillRow
        Insert: Pick<BillRow, 'user_id' | 'name' | 'amount'> &
          Partial<Omit<BillRow, 'user_id' | 'name' | 'amount'>>
        Update: Partial<Omit<BillRow, 'id' | 'user_id'>>
        Relationships: []
      }
      user_settings: {
        Row: UserSettingsRow
        Insert: Pick<UserSettingsRow, 'user_id'> &
          Partial<Omit<UserSettingsRow, 'user_id'>>
        Update: Partial<Omit<UserSettingsRow, 'user_id'>>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
  }
}
