export const deptAccent: Record<string, string> = {
  ENG: 'bg-amber-100 text-amber-800 border-amber-300',
  ST: 'bg-purple-100 text-purple-800 border-purple-300',
  OHE: 'bg-blue-100 text-blue-800 border-blue-300',
}

export function statusClass(status: string) {
  const key = status.toLowerCase()
  if (key.includes('overdue')) return 'bg-red-100 text-red-800 border-red-300'
  if (key.includes('scheduled')) return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (key.includes('pending')) return 'bg-amber-100 text-amber-800 border-amber-300'
  return 'bg-slate-100 text-slate-800 border-slate-300'
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
