import { defineStore } from 'pinia'
import type { Entry } from '~/utils/db'
import { SEED_ENTRIES } from '~/utils/seed'
import { toKg } from '~/utils/units'

export const useWorkoutStore = defineStore('workout', {
  state: () => ({ entries: [] as Entry[], ready: false }),

  getters: {
    exercises: (s) => Array.from(new Set(s.entries.map((e) => e.exercise))).sort(),

    // Verified entries only, newest first.
    verified: (s) =>
      s.entries
        .filter((e) => e.source !== 'unverified')
        .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)),

    unverified: (s) => s.entries.filter((e) => e.source === 'unverified'),

    // Initial assessment in the original order the exercises were recorded.
    assessment: (s) =>
      s.entries.filter((e) => e.source === 'assessment').sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),

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

    async importJson(json: string) {
      const data = JSON.parse(json) as Entry[]
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
