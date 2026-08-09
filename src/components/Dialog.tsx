import type { MouseEvent, ReactNode } from 'react'

export function Dialog({
  title,
  onClose,
  children,
  actions,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  actions: ReactNode
}) {
  const stop = (e: MouseEvent) => e.stopPropagation()
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={stop}>
        <div className="flex items-baseline justify-between">
          <div className="dialog-title">{title}</div>
          <button onClick={onClose} className="btn btn-ghost text-xs">
            Esc
          </button>
        </div>
        {children}
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  )
}
