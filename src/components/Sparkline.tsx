import type { SparkBar } from '@/lib/sparkline'

export function Sparkline({
  bars,
  color,
  height = 34,
  barWidth = 2,
}: {
  bars: SparkBar[]
  color: string
  height?: number
  barWidth?: number
}) {
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            flex: '1 1 0',
            minWidth: barWidth,
            height: Math.max(2, b.heightPct) + '%',
            background: color,
            borderRadius: '1px',
          }}
        />
      ))}
    </div>
  )
}
