export function money(n: number): string {
  const r = Math.round(n * 100) / 100
  const s = r % 1 === 0 ? String(r) : r.toFixed(2)
  const parts = s.split('.')
  return (
    '$' +
    parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
    (parts[1] ? '.' + parts[1] : '')
  )
}

export function fmt(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}
