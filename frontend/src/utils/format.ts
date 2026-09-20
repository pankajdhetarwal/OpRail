export const deptAccent: Record<string, string> = {
  ENG: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  ST: 'bg-violet-500/15 text-violet-200 border-violet-500/40',
  OHE: 'bg-blue-500/15 text-blue-200 border-blue-500/40',
}

export function statusClass(status: string) {
  const key = status.toLowerCase()
  if (key.includes('overdue')) return 'bg-red-500/15 text-red-200 border-red-500/40'
  if (key.includes('scheduled')) return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
  if (key.includes('pending')) return 'bg-amber-500/15 text-amber-200 border-amber-500/40'
  return 'bg-slate-500/15 text-slate-200 border-slate-500/40'
}

export function severityColor(severity: number) {
  if (severity >= 5) return 'bg-red-500'
  if (severity >= 4) return 'bg-orange-500'
  if (severity >= 3) return 'bg-amber-500'
  if (severity >= 2) return 'bg-sky-500'
  return 'bg-emerald-500'
}

export function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToClock(minute: number) {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
