import { defineStore } from 'pinia'
import type { Entry } from '~/utils/db'
import { SEED_ENTRIES } from '~/utils/seed'
import { toKg } from '~/utils/units'
import { ALTERNATIVE_GROUPS } from '~/utils/exercises'

const SOURCES = ['assessment', 'logged', 'unverified']

export function parseBackup(json: string): Entry[] {
  const data = JSON.parse(json)
  const valid =
    Array.isArray(data) &&
    data.every(
      (e) =>
        e &&
        typeof e.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
        typeof e.exercise === 'string' &&
        typeof e.weight === 'number' &&
        (e.unit === 'lbs' || e.unit === 'kg') &&
        SOURCES.includes(e.source)
    )
  if (!valid) throw new Error('Not a Workout Log backup')
  return data
}

export const useWorkoutStore = defineStore('workout', {
  state: () => ({ entries: [] as Entry[], ready: false }),

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
      const slots: string[][] = []
      for (const name of this.exercises) {
        const group = ALTERNATIVE_GROUPS.find((g) => g.includes(name))
        const existing = group && slots.find((s) => group.includes(s[0]))
        if (existing) existing.push(name)
        else slots.push([name])
      }
      return slots
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
      this.ready = true
    },

    async add(entry: Entry) {
      const id = await useDb().entries.add(entry)
      this.entries.push({ ...entry, id })
    },

    async remove(id: number) {
      await useDb().entries.delete(id)
      this.entries = this.entries.filter((e) => e.id !== id)
    },

    async confirm(id: number, date: string) {
      await useDb().entries.update(id, { source: 'logged', date })
      const e = this.entries.find((x) => x.id === id)
      if (e) Object.assign(e, { source: 'logged', date })
    },

    // Throws before touching the database if the file isn't a Workout Log backup.
    async importJson(json: string) {
      const data = parseBackup(json)
      const db = useDb()
      await db.entries.clear()
      await db.entries.bulkAdd(data.map(({ id, ...rest }) => rest))
      this.entries = await db.entries.toArray()
    },

    exportJson() {
      return JSON.stringify(this.entries, null, 2)
    },

    exportMarkdown() {
      const rows = [...this.entries].sort((a, b) => a.date.localeCompare(b.date))
      const lines = ['# Workout Log', '', '| Date | Exercise | Weight | kg | Sets × Reps | Body kg | Source |', '|---|---|---:|---:|---|---:|---|']
      for (const e of rows) {
        lines.push(
          `| ${e.date} | ${e.exercise} | ${e.weight} ${e.unit}${e.perDumbbell ? '/db' : ''} | ${toKg(e.weight, e.unit)} | ${e.sets && e.reps ? `${e.sets} × ${e.reps}` : '—'} | ${e.bodyWeightKg ?? '—'} | ${e.source} |`
        )
      }
      return lines.join('\n')
    }
  }
})
