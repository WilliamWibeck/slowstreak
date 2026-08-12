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
  /** ISO 4217 code — how money is formatted on the expenses page. */
  currency: string
  /** Monthly spend target per category, in SEK. Absent key = no target set. */
  budget_targets: Record<string, number>
  updated_at: string
}

/** Whether a bank has actually taken the money yet. */
export type TxStatus = 'pending' | 'settled'

/** Which conversion produced amount_sek — see api/_lib/fx.ts. */
export type FxSource = 'native' | 'bank' | 'daily'

/**
 * One imported bank transaction. Written by the nightly sync job, read-only
 * from the app apart from category corrections.
 */
export type ExpenseTransactionRow = {
  id: string
  user_id: string
  /** Slug of the source account: 'seb', 'bank-norwegian', 'amex'. */
  account: string
  bank_transaction_id: string
  booking_date: string
  /** Negative for refunds, so category totals net out. */
  amount_sek: number
  original_amount: number
  original_currency: string
  fx_source: FxSource
  /** Untouched bank text. The categoriser reads it; nothing overwrites it. */
  merchant_raw: string
  merchant_key: string
  category: string
  category_locked: boolean
  status: TxStatus
  /** Money moved between your own accounts — excluded from spend. */
  is_transfer: boolean
  created_at: string
  updated_at: string
}

/** A PSD2 consent. One row per connected bank. */
export type BankConnectionRow = {
  id: string
  user_id: string
  account: string
  display_name: string
  currency: string
  /** PSD2 consent lapses roughly every 90 days. */
  consent_expires_at: string | null
  needs_reconnect: boolean
  last_error: string
  last_synced_at: string | null
  synced_through: string | null
}

/** Merchant substring → category, checked before the LLM on import. */
export type CategoryRuleRow = {
  id: string
  user_id: string
  substring: string
  category: string
  priority: number
  created_at: string
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
      // The sync job inserts these with the service_role key, not from the
      // browser — the app only reads them and corrects a category.
      expense_transactions: {
        Row: ExpenseTransactionRow
        Insert: Pick<
          ExpenseTransactionRow,
          | 'user_id'
          | 'account'
          | 'bank_transaction_id'
          | 'booking_date'
          | 'amount_sek'
          | 'original_amount'
          | 'original_currency'
          | 'status'
        > &
          Partial<Omit<ExpenseTransactionRow, 'id' | 'user_id'>>
        Update: Partial<Omit<ExpenseTransactionRow, 'id' | 'user_id'>>
        Relationships: []
      }
      bank_connections: {
        Row: BankConnectionRow
        Insert: Pick<BankConnectionRow, 'user_id' | 'account'> &
          Partial<Omit<BankConnectionRow, 'user_id' | 'account'>>
        Update: Partial<Omit<BankConnectionRow, 'id' | 'user_id'>>
        Relationships: []
      }
      category_rules: {
        Row: CategoryRuleRow
        Insert: Pick<CategoryRuleRow, 'user_id' | 'substring' | 'category'> &
          Partial<Omit<CategoryRuleRow, 'user_id' | 'substring' | 'category'>>
        Update: Partial<Omit<CategoryRuleRow, 'id' | 'user_id'>>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
  }
}
