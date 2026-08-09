import type { KeyboardEvent, MouseEvent } from 'react'
import type { HabitRow } from '@/lib/database.types'
import { useTracker } from '@/state/TrackerContext'

const stop = (e: MouseEvent) => e.stopPropagation()

export function HabitCard({ habit }: { habit: HabitRow }) {
  const {
    seriesByHabit,
    toggleHabit,
    openLogModal,
    goHabit,
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
  } = useTracker()

  const series = seriesByHabit[habit.id]
  const t = series?.today
  const minutes = t?.minutes ?? 0
  const isEditingMinutes = editing === habit.id
  const isEditingNote = editingNote === habit.id
  const isEditingFocus = editingFocus === habit.id

  const onMinutesKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      e.stopPropagation()
      cancelEditMinutes()
    }
  }
  const onNoteKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      e.stopPropagation()
      cancelEditNote()
    }
  }
  const onFocusKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      e.stopPropagation()
      cancelEditFocus()
    }
  }

  return (
    <div
      onClick={() => toggleHabit(habit.id)}
      title="Click to toggle done"
      className="card flex cursor-pointer flex-col gap-0 rounded-md bg-surface p-6"
      style={{
        boxShadow: minutes
          ? '0 0 0 1px var(--color-accent-700)'
          : 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            onClick={(e) => {
              stop(e)
              goHabit(habit.id)
            }}
            className="cursor-pointer font-heading text-[17px] font-medium hover:text-accent"
          >
            {habit.name}
          </div>
          {habit.goal && (
            <div className="mt-2 text-[11px] text-neutral-500">
              {habit.goal}
            </div>
          )}

          {isEditingFocus ? (
            <input
              type="text"
              autoFocus
              value={focusValue}
              onChange={(e) => setFocusValue(e.target.value)}
              onBlur={commitEditFocus}
              onKeyDown={onFocusKey}
              onClick={stop}
              placeholder="Currently…"
              className="mt-1.5 w-full border-0 border-b border-dashed border-neutral-700 bg-transparent p-0.5 font-body text-[11px] text-text outline-none"
            />
          ) : (
            <div
              onClick={(e) => {
                stop(e)
                startEditFocus(habit.id)
              }}
              title="Click to edit"
              className="mt-1.5 cursor-pointer text-[11px]"
              style={{
                color: habit.focus
                  ? 'var(--color-accent)'
                  : 'var(--color-neutral-600)',
              }}
            >
              {habit.focus || 'Add a focus'}
            </div>
          )}
        </div>

        <div
          onClick={(e) => {
            stop(e)
            toggleHabit(habit.id)
          }}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm"
          style={{
            border:
              '1px solid ' +
              (minutes ? 'var(--color-accent)' : 'var(--color-neutral-800)'),
            background: minutes ? 'var(--color-accent-800)' : 'transparent',
            color: minutes ? 'var(--color-accent-100)' : 'transparent',
          }}
        >
          {minutes ? '✓' : ''}
        </div>
      </div>

      <div className="mt-8 flex items-baseline gap-2">
        {isEditingMinutes ? (
          <input
            type="number"
            min={0}
            max={1440}
            step={5}
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEditMinutes}
            onKeyDown={onMinutesKey}
            onClick={stop}
            className="w-24 border-0 border-b border-accent bg-transparent p-0 font-heading text-[32px] font-medium tracking-tight text-text outline-none"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />
        ) : (
          <span
            onClick={(e) => {
              stop(e)
              startEditMinutes(habit.id)
            }}
            title="Click to edit"
            className="cursor-text border-b border-transparent font-heading text-[32px] font-medium tracking-tight"
            style={{
              color: minutes ? 'var(--color-text)' : 'var(--color-neutral-700)',
            }}
          >
            {minutes}
          </span>
        )}
        <span className="text-xs text-neutral-500">min today</span>
      </div>

      <div className="mt-3 h-[3px] overflow-hidden rounded-sm bg-neutral-900">
        <div
          className="h-full rounded-sm bg-accent"
          style={{
            width: Math.min(100, (minutes / habit.target_minutes) * 100) + '%',
            transition: 'width 200ms ease',
          }}
        />
      </div>

      {isEditingNote ? (
        <input
          type="text"
          autoFocus
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          onBlur={commitEditNote}
          onKeyDown={onNoteKey}
          onClick={stop}
          placeholder="What did you do?"
          className="mt-4 w-full border-0 border-b border-accent bg-transparent p-0 pb-[3px] font-body text-[13px] text-text outline-none"
        />
      ) : (
        <div
          onClick={(e) => {
            stop(e)
            startEditNote(habit.id)
          }}
          title="Click to edit"
          className="mt-4 min-h-[20px] cursor-pointer text-[13px] leading-relaxed"
          style={{
            color: t?.note
              ? 'var(--color-neutral-400)'
              : 'var(--color-neutral-600)',
          }}
        >
          {t?.note || 'Add a note'}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          {series && series.streak > 0
            ? series.streak + ' day streak'
            : 'no streak yet'}
        </span>
        <button
          onClick={(e) => {
            stop(e)
            openLogModal(habit.id)
          }}
          className="btn btn-ghost text-[11px]"
        >
          Log
        </button>
      </div>
    </div>
  )
}
