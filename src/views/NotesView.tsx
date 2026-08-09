import { noteDateLabel } from '@/lib/date'
import { useTracker } from '@/state/TrackerContext'

export function NotesView() {
  const {
    notesByDate,
    notesKeys,
    selectedNoteIso,
    selectNote,
    setNoteAt,
    noteSaved,
    todayISO,
  } = useTracker()

  const summary =
    notesKeys.length + (notesKeys.length === 1 ? ' entry' : ' entries')
  const selLabel = selectedNoteIso
    ? noteDateLabel(selectedNoteIso, todayISO) + ' · ' + selectedNoteIso
    : 'No note selected'

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-divider pb-8">
        <div>
          <div className="mb-3 text-[10px] tracking-[0.12em] text-accent uppercase">
            Journal
          </div>
          <h1 className="m-0 font-heading text-[30px] font-medium tracking-tight">
            Past notes
          </h1>
        </div>
        <div className="text-[11px] text-neutral-500">{summary}</div>
      </header>

      <section className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_1fr]">
        <div className="card max-h-[560px] gap-0.5 overflow-auto p-3 shadow-sm">
          {notesKeys.map((k) => {
            const active = k === selectedNoteIso
            return (
              <div
                key={k}
                onClick={() => selectNote(k)}
                className="flex cursor-pointer flex-col gap-[3px] rounded-md border-l-2 px-3 py-2.5"
                style={{
                  background: active ? 'var(--color-surface)' : 'transparent',
                  borderColor: active ? 'var(--color-accent)' : 'transparent',
                }}
              >
                <div
                  className="text-xs"
                  style={{
                    color: active
                      ? 'var(--color-text)'
                      : 'var(--color-neutral-400)',
                  }}
                >
                  {noteDateLabel(k, todayISO)}
                </div>
                <div className="truncate text-xs leading-snug text-neutral-500">
                  {(notesByDate[k] ?? '').replace(/\s+/g, ' ').slice(0, 64)}
                </div>
              </div>
            )
          })}
          {notesKeys.length === 0 && (
            <div className="p-6 text-xs leading-relaxed text-neutral-600">
              No notes yet. Write one on the dashboard and it will show up here.
            </div>
          )}
        </div>

        <div className="card min-h-[320px] gap-4 p-6 shadow-sm">
          <div className="flex items-baseline justify-between">
            <div className="font-heading text-base font-medium">{selLabel}</div>
            <div
              className="text-[11px] text-accent-300"
              style={{
                opacity: noteSaved ? 1 : 0,
                transition: 'opacity 300ms ease',
              }}
            >
              Saved
            </div>
          </div>
          <textarea
            // Remount on selection change so the textarea picks up the new day's text.
            key={selectedNoteIso ?? 'none'}
            className="input"
            defaultValue={
              selectedNoteIso ? (notesByDate[selectedNoteIso] ?? '') : ''
            }
            onBlur={(e) =>
              selectedNoteIso && setNoteAt(selectedNoteIso, e.target.value)
            }
            placeholder="Nothing written for this day"
            disabled={!selectedNoteIso}
            style={{ minHeight: 260, lineHeight: 1.7, resize: 'vertical' }}
          />
        </div>
      </section>
    </div>
  )
}
