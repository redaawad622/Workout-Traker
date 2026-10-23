import { defineStore } from 'pinia'
import type { CustomFood, Entry, Meal } from '~/utils/db'
import { SEED_ENTRIES } from '~/utils/seed'
import { toKg } from '~/utils/units'
import { ALTERNATIVE_GROUPS, DEFAULT_SPLIT, SPLIT_DAYS, slotsOf, type DayType, type SplitDay } from '~/utils/exercises'

const SOURCES = ['assessment', 'logged', 'unverified']

const isDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
const isNutrients = (n: any) => n && typeof n === 'object' && typeof n.kcal === 'number'

export interface Backup {
  entries: Entry[]
  meals?: Meal[] // absent in backups made before the diet log
  foods?: CustomFood[]
}

// Accepts the original format (a bare array of entries) and the current one
// ({ entries, meals, foods }).
export function parseBackup(json: string): Backup {
  const data = JSON.parse(json)
  const backup: Backup = Array.isArray(data) ? { entries: data } : data ?? {}
  const valid =
    Array.isArray(backup.entries) &&
    backup.entries.every(
      (e) =>
        e &&
        isDate(e.date) &&
        typeof e.exercise === 'string' &&
        typeof e.weight === 'number' &&
        (e.unit === 'lbs' || e.unit === 'kg') &&
        SOURCES.includes(e.source)
    ) &&
    (backup.meals === undefined ||
      (Array.isArray(backup.meals) &&
        backup.meals.every((m) => m && isDate(m.date) && typeof m.name === 'string' && typeof m.grams === 'number' && isNutrients(m.per100)))) &&
    (backup.foods === undefined ||
      (Array.isArray(backup.foods) && backup.foods.every((f) => f && typeof f.name === 'string' && isNutrients(f.per100))))
  if (!valid) throw new Error('Not a Workout Tracker backup')
  return backup
}

export const useWorkoutStore = defineStore('workout', {
  state: () => ({
    entries: [] as Entry[],
    ready: false,
    // Routine kept in the meta table (no schema change): which way new days default to,
    // and the push/pull/legs lists.
    mode: 'full' as 'full' | 'split',
    split: structuredClone(DEFAULT_SPLIT) as Record<SplitDay, string[]>,
    // Which kind of day each date was trained as, keyed by YYYY-MM-DD (meta keys "day:<date>").
    dayTypes: {} as Record<string, DayType>
  }),

  getters: {
    // Original order of first appearance (assessment order), then newly added exercises.
    exercises: (s) => {
      const list = Array.from(
        new Set([...s.entries].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).map((e) => e.exercise))
      )
      // Make sure every alternative shows up, right after its sibling.
      for (const group of ALTERNATIVE_GROUPS) {
        const present = group.filter((n) => list.includes(n))
        if (!present.length) continue
        let at = Math.max(...present.map((n) => list.indexOf(n)))
        for (const n of group) {
          if (!list.includes(n)) list.splice(++at, 0, n)
        }
      }
      return list
    },

    // Training slots in order: alternatives (either/or) share one slot.
    slots(): string[][] {
      return slotsOf(this.exercises)
    },

    // Exercises planned for a kind of day: full body = everything, in training order.
    planFor() {
      return (type: DayType) => (type === 'full' ? this.exercises : this.split[type])
    },

    // Split day that follows the most recent logged split day before `date`.
    nextSplitDay() {
      return (date: string): SplitDay => {
        const prev = this.sessions.find((s) => s.date < date && this.dayTypes[s.date] && this.dayTypes[s.date] !== 'full')
        if (!prev) return SPLIT_DAYS[0]
        const i = SPLIT_DAYS.indexOf(this.dayTypes[prev.date] as SplitDay)
        return SPLIT_DAYS[(i + 1) % SPLIT_DAYS.length]
      }
    },

    // Verified entries only, newest first.
    verified: (s) =>
      s.entries
        .filter((e) => e.source !== 'unverified')
        .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)),

    unverified: (s) => s.entries.filter((e) => e.source === 'unverified'),

    // Initial assessment in the original order the exercises were recorded.
    assessment: (s) =>
      s.entries.filter((e) => e.source === 'assessment').sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),

    // All exercise names in original order (assessment order first, then others as first seen).
    exerciseOrder: (s) => {
      const sorted = [...s.entries].sort((a, b) => {
        const rank = (e: Entry) => (e.source === 'assessment' ? 0 : 1)
        return rank(a) - rank(b) || (a.id ?? 0) - (b.id ?? 0)
      })
      return Array.from(new Set(sorted.map((e) => e.exercise)))
    },

    // Logged sessions grouped by date, newest first.
    sessions: (s) => {
      const map = new Map<string, Entry[]>()
      for (const e of s.entries.filter((x) => x.source === 'logged').sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
        map.set(e.date, [...(map.get(e.date) ?? []), e])
      }
      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, items]) => ({ date, items, bodyWeightKg: items.find((i) => i.bodyWeightKg)?.bodyWeightKg }))
    },

    byExercise() {
      return (name: string) =>
        this.verified.filter((e) => e.exercise === name)
    },

    latestBodyWeight(): number | undefined {
      return this.verified.find((e) => e.bodyWeightKg)?.bodyWeightKg
    },

    summary(): { exercise: string; latest: Entry; previous?: Entry; deltaKg?: number }[] {
      return this.exercises
        .map((exercise) => {
          const list = this.byExercise(exercise)
          if (!list.length) return null
          const [latest, previous] = list
          const deltaKg = previous ? Math.round((toKg(latest.weight, latest.unit) - toKg(previous.weight, previous.unit)) * 10) / 10 : undefined
          return { exercise, latest, previous, deltaKg }
        })
        .filter(Boolean) as any
    }
  },

  actions: {
    async load() {
      const db = useDb()
      const seeded = await db.meta.get('seeded')
      if (!seeded) {
        await db.entries.bulkAdd(SEED_ENTRIES)
        await db.meta.put({ key: 'seeded', value: true })
      }
      this.entries = await db.entries.toArray()
      const routine = (await db.meta.get('routine'))?.value as { mode?: 'full' | 'split'; split?: Record<SplitDay, string[]> } | undefined
      if (routine?.mode) this.mode = routine.mode
      if (routine?.split) Object.assign(this.split, routine.split)
      for (const m of await db.meta.where('key').startsWith('day:').toArray()) {
        this.dayTypes[m.key.slice(4)] = m.value as DayType
      }
      this.ready = true
    },

    async add(entry: Entry) {
      const id = await useDb().entries.add(entry)
      this.entries.push({ ...entry, id })
    },

    async saveRoutine() {
      await useDb().meta.put({ key: 'routine', value: { mode: this.mode, split: structuredClone(toRaw(this.split)) } })
    },

    // Pick the kind of day for a date. Also becomes the default for new days.
    async setDayType(date: string, type: DayType) {
      this.dayTypes[date] = type
      this.mode = type === 'full' ? 'full' : 'split'
      await useDb().meta.put({ key: `day:${date}`, value: type })
      await this.saveRoutine()
    },

    async addToSplit(day: SplitDay, exercise: string) {
      if (this.split[day].includes(exercise)) return
      this.split[day].push(exercise)
      await this.saveRoutine()
    },

    async remove(id: number) {
      await useDb().entries.delete(id)
      this.entries = this.entries.filter((e) => e.id !== id)
    },

    async update(id: number, changes: Partial<Entry>) {
      await useDb().entries.update(id, changes)
      const e = this.entries.find((x) => x.id === id)
      if (e) Object.assign(e, changes)
    },

    async confirm(id: number, date: string) {
      await useDb().entries.update(id, { source: 'logged', date })
      const e = this.entries.find((x) => x.id === id)
      if (e) Object.assign(e, { source: 'logged', date })
    },

    // Throws before touching the database if the file isn't a Workout Tracker backup.
    // Meals and foods are only replaced when the file has them, so an older
    // workouts-only backup leaves the diet log alone.
    async importJson(json: string) {
      const data = parseBackup(json)
      const db = useDb()
      const strip = <T extends { id?: number }>(list: T[]) => list.map(({ id, ...rest }) => rest as T)
      await db.transaction('rw', db.entries, db.meals, db.foods, async () => {
        await db.entries.clear()
        await db.entries.bulkAdd(strip(data.entries))
        if (data.meals) {
          await db.meals.clear()
          await db.meals.bulkAdd(strip(data.meals))
        }
        if (data.foods) {
          await db.foods.clear()
          await db.foods.bulkAdd(strip(data.foods))
        }
      })
      this.entries = await db.entries.toArray()
      return data
    },

    async exportJson() {
      const db = useDb()
      const [meals, foods] = await Promise.all([db.meals.toArray(), db.foods.toArray()])
      return JSON.stringify({ app: 'workout-log', version: 2, entries: this.entries, meals, foods }, null, 2)
    },

    exportMarkdown() {
      const rows = [...this.entries].sort((a, b) => a.date.localeCompare(b.date))
      const lines = ['# Workout Tracker', '', '| Date | Exercise | Weight | kg | Sets × Reps | Body kg | Source |', '|---|---|---:|---:|---|---:|---|']
      for (const e of rows) {
        lines.push(
          `| ${e.date} | ${e.exercise} | ${e.weight} ${e.unit}${e.perDumbbell ? '/db' : ''} | ${toKg(e.weight, e.unit)} | ${e.sets && e.reps ? `${e.sets} × ${e.reps}` : '—'} | ${e.bodyWeightKg ?? '—'} | ${e.source} |`
        )
      }
      return lines.join('\n')
    }
  }
})
