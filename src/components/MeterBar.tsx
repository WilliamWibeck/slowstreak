/**
 * The labelled horizontal bar used by both spending pages.
 *
 * Lifted out of the expenses page's "Where it goes" list so the budget page
 * renders in the same visual language as the rest of the app rather than
 * bringing its own — same track height, same radius, same accent ramp the
 * heatmaps grade their days with.
 */
export function MeterBar({
  label,
  meta,
  pct,
  pendingPct = 0,
  over = false,
  muted = false,
}: {
  label: string
  /** Right-aligned figure — an amount, a percentage, "of 6 000 kr". */
  meta: string
  /** Filled share of the track, 0–100. */
  pct: number
  /** How much of `pct` is still pending, drawn as a lighter tail. */
  pendingPct?: number
  /** Spent past the target. */
  over?: boolean
  /** No target set — the bar is informational, so it recedes. */
  muted?: boolean
}) {
  const settled = Math.max(0, pct - pendingPct)
  const fill = over
    ? 'var(--color-over-budget)'
    : muted
      ? 'var(--color-accent-700)'
      : 'var(--color-accent)'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4 text-xs">
        <span className="truncate">{label}</span>
        <span
          className="shrink-0 tabular-nums"
          style={{ color: over ? 'var(--color-over-budget)' : undefined }}
        >
          {meta}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-[3px] bg-surface">
        <div
          className="h-full"
          style={{ width: settled + '%', background: fill }}
        />
        {pendingPct > 0 && (
          // Pending money is included in "spent so far" but drawn distinctly:
          // it is real enough to budget against and provisional enough that
          // the final figure may still move.
          <div
            className="h-full"
            style={{
              width: pendingPct + '%',
              backgroundImage: `repeating-linear-gradient(115deg, ${
                over ? 'var(--color-over-budget)' : 'var(--color-accent)'
              } 0 3px, transparent 3px 6px)`,
            }}
          />
        )}
      </div>
    </div>
  )
}
