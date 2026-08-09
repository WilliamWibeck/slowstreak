import { useTracker } from '@/state/TrackerContext'
import { Dialog } from '@/components/Dialog'

export function HabitModal() {
  const {
    habitModal,
    habitDraft,
    setHabitField,
    saveHabit,
    closeHabitModal,
    removeHabit,
  } = useTracker()
  if (!habitModal) return null
  const isNew = habitModal === 'new'

  return (
    <Dialog
      title={isNew ? 'Add a habit' : 'Edit habit'}
      onClose={closeHabitModal}
      actions={
        <>
          {!isNew && (
            <button
              onClick={() => removeHabit(habitModal)}
              className="btn btn-ghost mr-auto text-xs"
            >
              Delete
            </button>
          )}
          <button onClick={closeHabitModal} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={saveHabit} className="btn btn-primary">
            {isNew ? 'Add habit' : 'Save habit'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="habit-name">Name</label>
        <input
          id="habit-name"
          type="text"
          className="input"
          value={habitDraft.name}
          onChange={(e) => setHabitField('name', e.target.value)}
          placeholder="Reading"
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="habit-goal">Goal</label>
        <input
          id="habit-goal"
          type="text"
          className="input"
          value={habitDraft.goal}
          onChange={(e) => setHabitField('goal', e.target.value)}
          placeholder="Daily · 30 min"
        />
        <div className="mt-1.5 text-[11px] text-neutral-600">
          Free text, shown under the habit name.
        </div>
      </div>

      <div className="field">
        <label htmlFor="habit-focus">Current focus</label>
        <input
          id="habit-focus"
          type="text"
          className="input"
          value={habitDraft.focus}
          onChange={(e) => setHabitField('focus', e.target.value)}
          placeholder="The Dispossessed"
        />
        <div className="mt-1.5 text-[11px] text-neutral-600">
          What you're on right now — a book, a training block, a project. Also
          editable straight from the card.
        </div>
      </div>

      <div className="field">
        <label htmlFor="habit-target">Daily target (minutes)</label>
        <input
          id="habit-target"
          type="number"
          min={1}
          max={1440}
          step={5}
          className="input"
          value={habitDraft.target}
          onChange={(e) => setHabitField('target', e.target.value)}
        />
        <div className="mt-1.5 text-[11px] text-neutral-600">
          Sets how full the progress bar and heatmap colour read for a day.
        </div>
      </div>

      {!isNew && (
        <div className="text-[11px] leading-relaxed text-neutral-600">
          Deleting archives the habit — its history stays in the database but it
          disappears from the app.
        </div>
      )}
    </Dialog>
  )
}
