import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  BankConnectionRow,
  BillRow,
  Cadence,
  ExpenseTransactionRow,
  HabitRow,
} from '@/lib/database.types'
import type { BillDraft, HabitDraft, HabitSeries, View } from '@/types'
import { useAuth } from '@/auth/AuthProvider'
import { applyTheme } from '@/data/themes'
import {
  useArchiveHabit,
  useBills,
  useConnections,
  useDeleteBill,
  useEntries,
  useHabits,
  useNotes,
  useSaveBill,
  useSaveHabit,
  useSeries,
  useSetTransactionCategory,
  useSettings,
  useToday,
  useTransactions,
  useUpdateSettings,
  useUpsertEntry,
  useUpsertNote,
} from '@/hooks/useTrackerData'

type TrackerCtx = {
  // live data
  habits: HabitRow[]
  seriesByHabit: Record<string, HabitSeries>
  notesByDate: Record<string, string>
  notesKeys: string[]
  bills: BillRow[]
  /** Imported bank transactions, last six months. Always in SEK. */
  transactions: ExpenseTransactionRow[]
  connections: BankConnectionRow[]
  /** Monthly spend target per category, in SEK. */
  budgetTargets: Record<string, number>
  theme: string
  currency: string
  loading: boolean
  error: string | null

  today: Date
  todayISO: string

  // navigation / layout
  view: View
  selected: string | null
  narrow: boolean
  mid: boolean
  menuOpen: boolean
  goDashboard: () => void
  goAnalytics: () => void
  goWeek: () => void
  goNotes: () => void
  goExpenses: () => void
  goBudget: () => void
  goHabit: (id: string) => void
  toggleMenu: () => void
  pickTheme: (id: string) => void
  pickCurrency: (code: string) => void
  signOut: () => Promise<void>

  // logging
  toggleHabit: (habitId: string) => void
  modal: string | null
  draftMinutes: number
  draftNote: string
  openLogModal: (habitId: string) => void
  closeModal: () => void
  setDraftMinutes: (n: number) => void
  setDraftNote: (s: string) => void
  saveEntry: () => void

  // inline edits
  editing: string | null
  editValue: string
  setEditValue: (s: string) => void
  startEditMinutes: (habitId: string) => void
  commitEditMinutes: () => void
  cancelEditMinutes: () => void

  editingNote: string | null
  noteValue: string
  setNoteValue: (s: string) => void
  startEditNote: (habitId: string) => void
  commitEditNote: () => void
  cancelEditNote: () => void

  /** Per-habit "focus" line — inline-edited on the card, id of the habit being edited. */
  editingFocus: string | null
  focusValue: string
  setFocusValue: (s: string) => void
  startEditFocus: (habitId: string) => void
  commitEditFocus: () => void
  cancelEditFocus: () => void

  // journal
  noteSaved: boolean
  selectedNoteIso: string | null
  setNoteAt: (iso: string, body: string) => void
  selectNote: (iso: string) => void

  // bills
  billModal: string | null
  billDraft: BillDraft
  newBill: () => void
  editBill: (id: string) => void
  closeBillModal: () => void
  setBillField: <K extends keyof BillDraft>(k: K, v: BillDraft[K]) => void
  saveBill: () => void
  removeBill: (id: string) => void

  // budget
  /** null clears the target — distinct from a target of zero. */
  setBudgetTarget: (category: string, target: number | null) => void
  recategorize: (id: string, category: string) => void

  // habits CRUD
  habitModal: 'new' | string | null
  habitDraft: HabitDraft
  newHabit: () => void
  editHabit: (id: string) => void
  closeHabitModal: () => void
  setHabitField: <K extends keyof HabitDraft>(k: K, v: HabitDraft[K]) => void
  saveHabit: () => void
  removeHabit: (id: string) => void
}

const Ctx = createContext<TrackerCtx | null>(null)

const emptyBillDraft = (): BillDraft => ({
  name: '',
  amount: '',
  category: 'Utilities',
  cadence: 'monthly',
  day: 1,
})
const emptyHabitDraft = (): HabitDraft => ({
  name: '',
  goal: '',
  focus: '',
  target: '20',
})

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const { today, todayISO, from, budgetFrom } = useToday()

  const habitsQ = useHabits()
  const entriesQ = useEntries(from, todayISO)
  const notesQ = useNotes()
  const billsQ = useBills()
  const settingsQ = useSettings()
  const transactionsQ = useTransactions(budgetFrom)
  const connectionsQ = useConnections()

  const setCategoryM = useSetTransactionCategory(budgetFrom)
  const upsertEntry = useUpsertEntry(from, todayISO)
  const upsertNote = useUpsertNote()
  const saveBillM = useSaveBill()
  const deleteBillM = useDeleteBill()
  const saveHabitM = useSaveHabit()
  const archiveHabitM = useArchiveHabit()
  const updateSettingsM = useUpdateSettings()

  const habits = useMemo(() => habitsQ.data ?? [], [habitsQ.data])
  const entries = useMemo(() => entriesQ.data ?? [], [entriesQ.data])
  const bills = useMemo(() => billsQ.data ?? [], [billsQ.data])
  const transactions = useMemo(
    () => transactionsQ.data ?? [],
    [transactionsQ.data],
  )
  const connections = useMemo(
    () => connectionsQ.data ?? [],
    [connectionsQ.data],
  )
  const seriesByHabit = useSeries(habits, entries, today)

  const notesByDate = useMemo(() => {
    const out: Record<string, string> = {}
    for (const n of notesQ.data ?? []) out[n.note_date] = n.body
    return out
  }, [notesQ.data])
  const notesKeys = useMemo(
    () =>
      Object.keys(notesByDate)
        .filter((k) => notesByDate[k]?.trim())
        .sort()
        .reverse(),
    [notesByDate],
  )

  const theme = settingsQ.data?.theme ?? 'nocturne'
  const currency = settingsQ.data?.currency ?? 'USD'
  const budgetTargets = useMemo(
    () => settingsQ.data?.budget_targets ?? {},
    [settingsQ.data?.budget_targets],
  )

  // UI state
  const [view, setView] = useState<View>('dashboard')
  const [selected, setSelected] = useState<string | null>(null)
  const [narrow, setNarrow] = useState(false)
  const [mid, setMid] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [draftMinutes, setDraftMinutes] = useState(20)
  const [draftNote, setDraftNote] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState('')
  const [editingFocus, setEditingFocus] = useState<string | null>(null)
  const [focusValue, setFocusValue] = useState('')
  const [noteSel, setNoteSel] = useState<string | null>(null)
  const [noteSaved, setNoteSaved] = useState(false)
  const [billModal, setBillModal] = useState<string | null>(null)
  const [billDraft, setBillDraft] = useState<BillDraft>(emptyBillDraft())
  const [habitModal, setHabitModal] = useState<'new' | string | null>(null)
  const [habitDraft, setHabitDraft] = useState<HabitDraft>(emptyHabitDraft())

  const noteTimer = useRef<number | undefined>(undefined)
  const selectedNoteIso = noteSel ?? notesKeys[0] ?? null

  // Repaint design tokens whenever the stored theme changes.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth
      const nextNarrow = w < 900
      const nextMid = w < 1240
      setNarrow((p) => (p === nextNarrow ? p : nextNarrow))
      setMid((p) => (p === nextMid ? p : nextMid))
      if (nextNarrow) setMenuOpen(false)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(null)
        setBillModal(null)
        setHabitModal(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const flashSaved = useCallback(() => {
    setNoteSaved(true)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNoteSaved(false), 1400)
  }, [])

  const goDashboard = useCallback(() => {
    setView('dashboard')
    setMenuOpen(false)
  }, [])
  const goAnalytics = useCallback(() => {
    setView('analytics')
    setMenuOpen(false)
  }, [])
  const goWeek = useCallback(() => {
    setView('week')
    setMenuOpen(false)
  }, [])
  const goNotes = useCallback(() => {
    setView('notes')
    setMenuOpen(false)
  }, [])
  const goExpenses = useCallback(() => {
    setView('expenses')
    setMenuOpen(false)
  }, [])
  const goBudget = useCallback(() => {
    setView('budget')
    setMenuOpen(false)
  }, [])
  const goHabit = useCallback((id: string) => {
    setView('habit')
    setSelected(id)
    setMenuOpen(false)
  }, [])
  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), [])

  const pickTheme = useCallback(
    (id: string) => {
      applyTheme(id) // paint immediately; the write-back is best-effort
      updateSettingsM.mutate({ theme: id })
    },
    [updateSettingsM],
  )
  const pickCurrency = useCallback(
    (code: string) => updateSettingsM.mutate({ currency: code }),
    [updateSettingsM],
  )

  const isEditingSomething =
    editing !== null || editingNote !== null || editingFocus !== null

  const toggleHabit = useCallback(
    (habitId: string) => {
      if (isEditingSomething) return
      const habit = habits.find((h) => h.id === habitId)
      if (!habit) return
      const cur = seriesByHabit[habitId]?.today.minutes ?? 0
      upsertEntry.mutate({
        habitId,
        date: todayISO,
        minutes: cur > 0 ? 0 : habit.target_minutes,
        note: cur > 0 ? '' : (seriesByHabit[habitId]?.today.note ?? ''),
      })
    },
    [isEditingSomething, habits, seriesByHabit, todayISO, upsertEntry],
  )

  const openLogModal = useCallback(
    (habitId: string) => {
      const habit = habits.find((h) => h.id === habitId)
      const t = seriesByHabit[habitId]?.today
      setModal(habitId)
      setDraftMinutes(t?.minutes || habit?.target_minutes || 20)
      setDraftNote(t?.note ?? '')
    },
    [habits, seriesByHabit],
  )
  const closeModal = useCallback(() => setModal(null), [])
  const saveEntry = useCallback(() => {
    if (!modal) return
    upsertEntry.mutate({
      habitId: modal,
      date: todayISO,
      minutes: draftMinutes,
      note: draftNote,
    })
    setModal(null)
  }, [modal, todayISO, draftMinutes, draftNote, upsertEntry])

  const startEditMinutes = useCallback(
    (habitId: string) => {
      setEditing(habitId)
      setEditValue(String(seriesByHabit[habitId]?.today.minutes ?? 0))
    },
    [seriesByHabit],
  )
  const cancelEditMinutes = useCallback(() => setEditing(null), [])
  const commitEditMinutes = useCallback(() => {
    if (!editing) return
    const minutes = Math.max(0, Math.min(1440, Number(editValue) || 0))
    upsertEntry.mutate({
      habitId: editing,
      date: todayISO,
      minutes,
      note: seriesByHabit[editing]?.today.note ?? '',
    })
    setEditing(null)
  }, [editing, editValue, todayISO, seriesByHabit, upsertEntry])

  const startEditNote = useCallback(
    (habitId: string) => {
      setEditingNote(habitId)
      setNoteValue(seriesByHabit[habitId]?.today.note ?? '')
    },
    [seriesByHabit],
  )
  const cancelEditNote = useCallback(() => setEditingNote(null), [])
  const commitEditNote = useCallback(() => {
    if (!editingNote) return
    const habit = habits.find((h) => h.id === editingNote)
    const t = seriesByHabit[editingNote]?.today
    const note = noteValue.trim()
    upsertEntry.mutate({
      habitId: editingNote,
      date: todayISO,
      // Writing a note on an unlogged day counts it as done at target.
      minutes: t?.minutes || (note ? (habit?.target_minutes ?? 0) : 0),
      note,
    })
    setEditingNote(null)
  }, [editingNote, noteValue, habits, seriesByHabit, todayISO, upsertEntry])

  const startEditFocus = useCallback(
    (habitId: string) => {
      setEditingFocus(habitId)
      setFocusValue(habits.find((h) => h.id === habitId)?.focus ?? '')
    },
    [habits],
  )
  const cancelEditFocus = useCallback(() => setEditingFocus(null), [])
  const commitEditFocus = useCallback(() => {
    if (!editingFocus) return
    const habit = habits.find((h) => h.id === editingFocus)
    if (habit) {
      saveHabitM.mutate({
        id: habit.id,
        name: habit.name,
        goal: habit.goal,
        focus: focusValue.trim(),
        targetMinutes: habit.target_minutes,
        sortOrder: habit.sort_order,
      })
    }
    setEditingFocus(null)
  }, [editingFocus, focusValue, habits, saveHabitM])

  const setNoteAt = useCallback(
    (iso: string, body: string) => {
      upsertNote.mutate({ date: iso, body })
      flashSaved()
    },
    [upsertNote, flashSaved],
  )
  const selectNote = useCallback((iso: string) => setNoteSel(iso), [])

  const newBill = useCallback(() => {
    setBillModal('new')
    setBillDraft(emptyBillDraft())
  }, [])
  const editBill = useCallback(
    (id: string) => {
      const b = bills.find((x) => x.id === id)
      if (!b) return
      setBillModal(b.id)
      setBillDraft({
        id: b.id,
        name: b.name,
        amount: String(b.amount),
        category: b.category,
        cadence: b.cadence,
        day: b.due_day,
      })
    },
    [bills],
  )
  const closeBillModal = useCallback(() => setBillModal(null), [])
  const setBillField = useCallback(
    <K extends keyof BillDraft>(k: K, v: BillDraft[K]) =>
      setBillDraft((d) => ({ ...d, [k]: v })),
    [],
  )
  const saveBill = useCallback(() => {
    const name = billDraft.name.trim()
    const amount = Number(billDraft.amount)
    if (!name || !(amount > 0)) return
    saveBillM.mutate({
      id: billModal === 'new' ? undefined : (billModal ?? undefined),
      name,
      amount,
      category: billDraft.category,
      cadence: billDraft.cadence as Cadence,
      dueDay: Number(billDraft.day) || 1,
    })
    setBillModal(null)
  }, [billDraft, billModal, saveBillM])
  const removeBill = useCallback(
    (id: string) => deleteBillM.mutate(id),
    [deleteBillM],
  )

  const setBudgetTarget = useCallback(
    (category: string, target: number | null) => {
      // The whole map is rewritten rather than patched: it lives in a single
      // jsonb column, so there is no partial update to make.
      const next = { ...budgetTargets }
      if (target === null) delete next[category]
      else next[category] = target
      updateSettingsM.mutate({ budget_targets: next })
    },
    [budgetTargets, updateSettingsM],
  )
  const recategorize = useCallback(
    (id: string, category: string) => setCategoryM.mutate({ id, category }),
    [setCategoryM],
  )

  const newHabit = useCallback(() => {
    setHabitModal('new')
    setHabitDraft(emptyHabitDraft())
  }, [])
  const editHabit = useCallback(
    (id: string) => {
      const h = habits.find((x) => x.id === id)
      if (!h) return
      setHabitModal(h.id)
      setHabitDraft({
        id: h.id,
        name: h.name,
        goal: h.goal,
        focus: h.focus,
        target: String(h.target_minutes),
      })
    },
    [habits],
  )
  const closeHabitModal = useCallback(() => setHabitModal(null), [])
  const setHabitField = useCallback(
    <K extends keyof HabitDraft>(k: K, v: HabitDraft[K]) =>
      setHabitDraft((d) => ({ ...d, [k]: v })),
    [],
  )
  const saveHabit = useCallback(() => {
    const name = habitDraft.name.trim()
    const target = Math.max(1, Math.min(1440, Number(habitDraft.target) || 20))
    if (!name) return
    saveHabitM.mutate({
      id: habitModal === 'new' ? undefined : (habitModal ?? undefined),
      name,
      goal: habitDraft.goal.trim(),
      focus: habitDraft.focus.trim(),
      targetMinutes: target,
      sortOrder: habits.length,
    })
    setHabitModal(null)
  }, [habitDraft, habitModal, habits.length, saveHabitM])
  const removeHabit = useCallback(
    (id: string) => {
      archiveHabitM.mutate(id)
      setHabitModal(null)
      if (selected === id) {
        setSelected(null)
        setView('dashboard')
      }
    },
    [archiveHabitM, selected],
  )

  const loading =
    habitsQ.isPending ||
    entriesQ.isPending ||
    notesQ.isPending ||
    billsQ.isPending ||
    settingsQ.isPending ||
    transactionsQ.isPending ||
    connectionsQ.isPending
  const error =
    (
      habitsQ.error ??
      entriesQ.error ??
      notesQ.error ??
      billsQ.error ??
      settingsQ.error ??
      transactionsQ.error ??
      connectionsQ.error
    )?.message ?? null

  const value: TrackerCtx = {
    habits,
    seriesByHabit,
    notesByDate,
    notesKeys,
    bills,
    transactions,
    connections,
    budgetTargets,
    theme,
    currency,
    loading,
    error,
    today,
    todayISO,
    view,
    selected,
    narrow,
    mid,
    menuOpen,
    goDashboard,
    goAnalytics,
    goWeek,
    goNotes,
    goExpenses,
    goBudget,
    goHabit,
    toggleMenu,
    pickTheme,
    pickCurrency,
    signOut,
    toggleHabit,
    modal,
    draftMinutes,
    draftNote,
    openLogModal,
    closeModal,
    setDraftMinutes,
    setDraftNote,
    saveEntry,
    editing,
    editValue,
    setEditValue,
    startEditMinutes,
    commitEditMinutes,
    cancelEditMinutes,
    editingNote,
    noteValue,
    setNoteValue,
    startEditNote,
    commitEditNote,
    cancelEditNote,
    editingFocus,
    focusValue,
    setFocusValue,
    startEditFocus,
    commitEditFocus,
    cancelEditFocus,
    noteSaved,
    selectedNoteIso,
    setNoteAt,
    selectNote,
    billModal,
    billDraft,
    newBill,
    editBill,
    closeBillModal,
    setBillField,
    saveBill,
    removeBill,
    setBudgetTarget,
    recategorize,
    habitModal,
    habitDraft,
    newHabit,
    editHabit,
    closeHabitModal,
    setHabitField,
    saveHabit,
    removeHabit,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTracker(): TrackerCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTracker must be used within a TrackerProvider')
  return ctx
}
