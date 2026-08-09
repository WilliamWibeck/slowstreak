import { longDate } from '@/lib/date'
import { useTracker } from '@/state/TrackerContext'
import { Dialog } from '@/components/Dialog'

const DURATIONS = [10, 15, 20, 30, 45, 60]

export function LogEntryModal() {
  const {
    modal,
    habits,
    today,
    draftMinutes,
    draftNote,
    setDraftMinutes,
    setDraftNote,
    saveEntry,
    closeModal,
  } = useTracker()
  if (!modal) return null
  const habit = habits.find((h) => h.id === modal)
  if (!habit) return null

  return (
    <Dialog
      title={'Log ' + habit.name}
      onClose={closeModal}
      actions={
        <>
          <button onClick={closeModal} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={saveEntry} className="btn btn-primary">
            Save entry
          </button>
        </>
      }
    >
      <div className="text-[11px] text-neutral-500">{longDate(today)}</div>

      <div className="mt-6 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
        Duration
      </div>
      <div className="flex flex-wrap gap-2">
        {DURATIONS.map((v) => (
          <div
            key={v}
            onClick={() => setDraftMinutes(v)}
            className="cursor-pointer rounded-md px-3.5 py-2 text-xs"
            style={{
              border:
                '1px solid ' +
                (draftMinutes === v
                  ? 'var(--color-accent)'
                  : 'var(--color-divider)'),
              color:
                draftMinutes === v
                  ? 'var(--color-accent)'
                  : 'var(--color-neutral-400)',
            }}
          >
            {v}m
          </div>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={120}
        step={5}
        value={draftMinutes}
        onChange={(e) => setDraftMinutes(Number(e.target.value))}
        className="w-full accent-[var(--color-accent)]"
      />
      <div className="text-xs text-neutral-400">{draftMinutes} minutes</div>

      <div className="mt-6 text-[10px] tracking-[0.1em] text-neutral-500 uppercase">
        Note
      </div>
      <input
        type="text"
        className="input"
        value={draftNote}
        onChange={(e) => setDraftNote(e.target.value)}
        placeholder="What did you do?"
      />
    </Dialog>
  )
}
