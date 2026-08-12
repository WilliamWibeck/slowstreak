import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/auth/AuthProvider'
import { LoginScreen } from '@/auth/LoginScreen'
import { TrackerProvider, useTracker } from '@/state/TrackerContext'
import { Sidebar } from '@/components/Sidebar'
import { LogEntryModal } from '@/components/LogEntryModal'
import { HabitModal } from '@/components/HabitModal'
import { DashboardView } from '@/views/DashboardView'
import { HabitView } from '@/views/HabitView'
import { AnalyticsView } from '@/views/AnalyticsView'
import { NotesView } from '@/views/NotesView'
import { ExpensesView } from '@/views/ExpensesView'
import { BudgetView } from '@/views/BudgetView'
import { Analytics } from '@vercel/analytics/react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

function Shell() {
  const { view, narrow, loading, error } = useTracker()

  return (
    <div
      className="min-h-screen bg-bg text-text"
      style={{
        display: 'grid',
        gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : '236px minmax(0, 1fr)',
      }}
    >
      <Sidebar />
      <main
        className={
          'min-w-0 max-w-[1340px] ' +
          (narrow ? 'p-6 pb-12' : 'px-[34px] pt-8 pb-[60px]')
        }
      >
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-md px-4 py-3 text-[13px]"
            style={{
              background: 'color-mix(in srgb, #f87171 12%, transparent)',
              color: '#fca5a5',
            }}
          >
            Couldn't reach the database: {error}
          </div>
        )}
        {loading ? (
          <div className="pt-8 text-[13px] text-neutral-500">Loading…</div>
        ) : (
          <>
            {view === 'dashboard' && <DashboardView />}
            {view === 'habit' && <HabitView />}
            {view === 'analytics' && <AnalyticsView />}
            {view === 'notes' && <NotesView />}
            {view === 'expenses' && <ExpensesView />}
            {view === 'budget' && <BudgetView />}
          </>
        )}
      </main>
      <LogEntryModal />
      <HabitModal />
    </div>
  )
}

function Gate() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg text-[13px] text-neutral-500">
        Loading…
      </div>
    )
  }
  if (!session) return <LoginScreen />
  return (
    <TrackerProvider>
      <Shell />
    </TrackerProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Gate />
      </AuthProvider>
      <Analytics />
    </QueryClientProvider>
  )
}
