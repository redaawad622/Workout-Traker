import type { Entry } from './db'
import { toKg, toLbs } from './units'

// Local calendar date as YYYY-MM-DD (toISOString would give the UTC date).
export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const asDate = (iso: string) => new Date(iso + 'T00:00:00')

export const daysBetween = (from: string, to: string) =>
  Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86400000)

const sameYear = (iso: string) => asDate(iso).getFullYear() === new Date().getFullYear()

// "22 Oct" (year added when it isn't this year)
export const fmtShort = (iso: string) =>
  asDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear(iso) ? {} : { year: 'numeric' }) })

// "Thu 22 Oct"
export const fmtDay = (iso: string) => `${asDate(iso).toLocaleDateString('en-GB', { weekday: 'short' })} ${fmtShort(iso)}`

// "Today" / "Yesterday" / "Thursday"
export function relativeDay(iso: string) {
  const diff = daysBetween(iso, todayISO())
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return asDate(iso).toLocaleDateString('en-GB', { weekday: 'long' })
}

export const fixed1 = (n: number) => n.toFixed(1)

type W = Pick<Entry, 'weight' | 'unit' | 'perDumbbell'>

// "130 lbs", "6 kg each"
export const weightText = (e: W) => `${e.weight} ${e.unit}${e.perDumbbell ? ' each' : ''}`

// The other unit: "59.0" for lbs entries (kg implied), "13.2 lbs" for kg entries.
export const convertedShort = (e: W) => (e.unit === 'lbs' ? fixed1(toKg(e.weight, 'lbs')) : `${fixed1(toLbs(e.weight, 'kg'))} lbs`)

// "18.1 kg" / "13.2 lbs"
export const convertedFull = (e: W) =>
  e.unit === 'lbs' ? `${fixed1(toKg(e.weight, 'lbs'))} kg` : `${fixed1(toLbs(e.weight, 'kg'))} lbs`

export const kgOf = (e: W) => toKg(e.weight, e.unit)

// "+2.3", "−1.1", "±0"
export function signed(n: number) {
  const r = Math.round(n * 10) / 10
  if (r === 0) return '±0'
  return r > 0 ? `+${fixed1(r)}` : `−${fixed1(-r)}`
}

// "Lateral Raise — Dumbbells" → ["Lateral Raise", "dumbbells"]
export function splitName(name: string): [string, string] {
  const [main, ...rest] = name.split(' — ')
  return [main, rest.join(' — ').toLowerCase()]
}
