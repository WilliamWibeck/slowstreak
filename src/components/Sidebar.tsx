import { THEMES, themeById } from '@/data/themes'
import { longDate } from '@/lib/date'
import { currencyCodes } from '@/lib/format'
import { useTracker } from '@/state/TrackerContext'
import { useAuth } from '@/auth/AuthProvider'
import type { View } from '@/types'

function navClass(active: boolean) {
  return (
    'flex items-center justify-between rounded-md px-2.5 py-2 text-[13px] cursor-pointer border-l-2 ' +
    (active
      ? 'bg-surface text-text border-accent'
      : 'border-transparent text-neutral-400 hover:text-text')
  )
}

const CURRENCIES = currencyCodes()

const VIEW_LABEL: Record<View, string> = {
  dashboard: 'Dashboard',
  habit: 'Practice',
  analytics: 'Analytics',
  notes: 'Notes',
  expenses: 'Expenses',
  budget: 'Budget',
}

export function Sidebar() {
  const {
    view,
    selected,
    habits,
    seriesByHabit,
    goDashboard,
    goAnalytics,
    goNotes,
    goExpenses,
    goBudget,
    goHabit,
    connections,
    narrow,
    menuOpen,
    toggleMenu,
    theme,
    pickTheme,
    currency,
    pickCurrency,
    today,
    newHabit,
    signOut,
  } = useTracker()
  const { user } = useAuth()

  const showMenu = !narrow || menuOpen
  const needsReconnect = connections.filter((c) => c.needs_reconnect).length

  return (
    <aside
      className={
        'sticky top-0 z-20 flex flex-col bg-bg ' +
        (narrow
          ? 'w-full gap-4 border-b border-divider p-6'
          : 'h-screen w-[236px] shrink-0 gap-8 overflow-y-auto border-r border-divider p-8')
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-sm bg-accent" />
          <div className="font-heading text-base font-medium">Slowstreak</div>
          {narrow && (
            <div className="ml-1 border-l border-divider pl-3 text-[11px] text-neutral-500">
              {VIEW_LABEL[view]}
            </div>
          )}
        </div>
        {narrow && (
          <button
            onClick={toggleMenu}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="btn btn-ghost btn-icon flex min-h-11 min-w-11 items-center justify-center gap-0"
          >
            <span
              className="block h-[1.5px] w-[15px] bg-accent"
              style={{
                boxShadow:
                  '0 -5px 0 var(--color-accent), 0 5px 0 var(--color-accent)',
              }}
            />
          </button>
        )}
      </div>

      {showMenu && (
        <div
          className={
            'flex min-h-0 flex-1 flex-col ' + (narrow ? 'gap-6' : 'gap-8')
          }
        >
          <div className="flex flex-col gap-0.5">
            <div className="px-2.5 pb-3 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              Views
            </div>
            <div
              onClick={goDashboard}
              className={navClass(view === 'dashboard')}
            >
              Dashboard
            </div>
            <div
              onClick={goAnalytics}
              className={navClass(view === 'analytics')}
            >
              Analytics
            </div>
            <div onClick={goNotes} className={navClass(view === 'notes')}>
              Notes
            </div>
            <div onClick={goExpenses} className={navClass(view === 'expenses')}>
              Expenses
            </div>
            <div onClick={goBudget} className={navClass(view === 'budget')}>
              <span>Budget</span>
              {/* A lapsed bank consent stops transactions arriving silently,
                  so it gets a marker outside the budget page too. */}
              {needsReconnect > 0 && (
                <span
                  aria-label={`${needsReconnect} bank connection needs reconnecting`}
                  className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--color-over-budget)' }}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between px-2.5 pb-3">
              <span className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
                Practices
              </span>
              <button
                onClick={newHabit}
                className="btn btn-ghost text-[11px]"
                title="Add a habit"
              >
                +
              </button>
            </div>
            {habits.map((h) => (
              <div
                key={h.id}
                onClick={() => goHabit(h.id)}
                className={navClass(view === 'habit' && selected === h.id)}
              >
                <span className="truncate">{h.name}</span>
                <span className="ml-2 shrink-0 text-[11px] text-neutral-500">
                  {seriesByHabit[h.id]?.streak ?? 0}d
                </span>
              </div>
            ))}
            {habits.length === 0 && (
              <div className="px-2.5 text-[11px] leading-relaxed text-neutral-600">
                No habits yet. Use + to add one.
              </div>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-2 text-[11px] leading-relaxed text-neutral-600">
            <div className="mb-3 h-px bg-divider" />
            <div className="text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              Palette
            </div>
            <div className="my-0.5 mb-2 flex items-center gap-3">
              {THEMES.map((t) => (
                <div
                  key={t.id}
                  onClick={() => pickTheme(t.id)}
                  title={t.name}
                  className="h-4 w-4 cursor-pointer rounded-sm"
                  style={{
                    background: t.accents.base,
                    boxShadow:
                      t.id === theme
                        ? '0 0 0 2px ' + t.bg + ', 0 0 0 3px ' + t.accents.base
                        : 'inset 0 0 0 1px rgba(0,0,0,0.35)',
                    opacity: t.id === theme ? 1 : 0.55,
                  }}
                />
              ))}
            </div>
            <div className="text-neutral-500">{themeById(theme).name}</div>

            <div className="mt-3 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
              Currency
            </div>
            <select
              value={currency}
              onChange={(e) => pickCurrency(e.target.value)}
              aria-label="Display currency"
              className="input mb-2 min-h-0 py-1 text-[11px]"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div>{longDate(today)}</div>
            <div className="truncate" title={user?.email ?? ''}>
              {user?.email}
            </div>
            <button
              onClick={signOut}
              className="btn btn-ghost self-start text-[11px]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
