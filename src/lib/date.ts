export function isoLocal(d: Date): string {
  const p = (n: number) => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

export function ordinal(d: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = d % 100
  return d + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export function longDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function noteDateLabel(iso: string, todayISO: string): string {
  const p = iso.split('-').map(Number)
  const d = new Date(p[0]!, p[1]! - 1, p[2]!)
  const t = todayISO.split('-').map(Number)
  const today = new Date(t[0]!, t[1]! - 1, t[2]!)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
