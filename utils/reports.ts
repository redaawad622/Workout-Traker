import type { Entry, Meal } from './db'
import { lbsToKg } from './units'
import { scale } from './nutrition'

export type Period = 'today' | 'week' | 'month' | 'all'

export const PERIODS: { key: Period; label: string; days?: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'week', label: 'Last 7 days', days: 7 },
  { key: 'month', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'All time' }
]

// First date (YYYY-MM-DD, local) inside a window of `days` days ending today.
export function windowStart(today: string, days: number) {
  const d = new Date(today + 'T00:00:00')
  d.setDate(d.getDate() - (days - 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const inPeriod = (date: string, today: string, days?: number) =>
  date <= today && (days === undefined || date >= windowStart(today, days))

// Weight lifted by one entry, in kg: weight × reps × sets, both dumbbells counted when
// the weight is per dumbbell. Baseline entries have no sets/reps and count as 0.
export function volumeKg(e: Entry) {
  if (!e.sets || !e.reps) return 0
  const kg = e.unit === 'kg' ? e.weight : lbsToKg(e.weight)
  return kg * e.reps * e.sets * (e.perDumbbell ? 2 : 1)
}

export interface Report {
  kcal: number
  kcalDays: number // days with at least one meal logged
  liftedKg: number
  sessions: number // days with at least one logged set
  sets: number
}

export function report(entries: Entry[], meals: Meal[], today: string, days?: number): Report {
  const lifts = entries.filter((e) => e.source === 'logged' && inPeriod(e.date, today, days))
  const eaten = meals.filter((m) => inPeriod(m.date, today, days))
  return {
    kcal: eaten.reduce((n, m) => n + scale(m.per100, m.grams).kcal, 0),
    kcalDays: new Set(eaten.map((m) => m.date)).size,
    liftedKg: lifts.reduce((n, e) => n + volumeKg(e), 0),
    sessions: new Set(lifts.filter((e) => volumeKg(e) > 0).map((e) => e.date)).size,
    sets: lifts.reduce((n, e) => n + (e.reps ? e.sets ?? 0 : 0), 0)
  }
}

// 12,345
export const grouped = (n: number) => Math.round(n).toLocaleString('en-US')
