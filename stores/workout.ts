import { defineStore } from 'pinia'
import type { CustomFood, Entry, Meal } from '~/utils/db'
import { SEED_ENTRIES } from '~/utils/seed'
import { toKg, type Unit } from '~/utils/units'
import type { AiExercise } from '~/utils/ai'
import {
  DAY_LABELS,
  DEFAULT_SPLIT,
  FULL_BODY,
  PPL,
  SPLIT_DAYS,
  STARTER_PROGRAMS,
  dayKey,
  isBuiltIn,
  programOfDay,
  slotsOf,
  type DayType,
  type Program,
  type ProgramDay,
  type SplitDay,
  withAlternatives,
  withDefaults
} from '~/utils/exercises'

const SOURCES = ['assessment', 'logged', 'unverified']

const isDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
const isNutrients = (n: any) => n && typeof n === 'object' && typeof n.kcal === 'number'

// Heaviest weight a machine's stack goes to, per exercise (meta key "machineMax").
export type MachineMax = Record<string, { weight: number; unit: Unit }>

// Sessions at the machine max before suggesting a harder exercise.
export const MAX_SESSIONS_TO_SWITCH = 3

export interface Backup {
  entries: Entry[]
  meals?: Meal[] // absent in backups made before the diet log
  foods?: CustomFood[]
  machineMax?: MachineMax // absent in backups made before machine maxes
  // Absent in backups made before custom programs.
  programs?: Program[]
  dayTypes?: Record<string, DayType>
  routine?: Routine
  skips?: Record<string, string[]> // absent in backups made before skipping
}

// Saved in meta key "routine". `mode` is what versions before custom programs read.
interface Routine {
  program?: string
  mode?: 'full' | 'split'
  split?: Record<SplitDay, string[]>
}

const isStrings = (l: unknown) => Array.isArray(l) && l.every((x) => typeof x === 'string')
const isProgram = (p: any) =>
  p &&
  typeof p.id === 'string' &&
  typeof p.name === 'string' &&
  Array.isArray(p.days) &&
  p.days.every((d: any) => d && typeof d.id === 'string' && typeof d.name === 'string' && isStrings(d.exercises))

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
      (Array.isArray(backup.foods) && backup.foods.every((f) => f && typeof f.name === 'string' && isNutrients(f.per100)))) &&
    (backup.machineMax === undefined ||
      (typeof backup.machineMax === 'object' &&
        Object.values(backup.machineMax).every((m: any) => m && typeof m.weight === 'number' && (m.unit === 'lbs' || m.unit === 'kg')))) &&
    (backup.programs === undefined || (Array.isArray(backup.programs) && backup.programs.every(isProgram))) &&
    (backup.dayTypes === undefined ||
      (typeof backup.dayTypes === 'object' &&
        Object.entries(backup.dayTypes).every(([d, t]) => isDate(d) && typeof t === 'string'))) &&
    (backup.routine === undefined || typeof backup.routine === 'object') &&
    (backup.skips === undefined ||
      (typeof backup.skips === 'object' && Object.entries(backup.skips).every(([d, l]) => isDate(d) && isStrings(l))))
  if (!valid) throw new Error('Not a Workout Tracker backup')
  return backup
}

export const useWorkoutStore = defineStore('workout', {
  state: () => ({
    entries: [] as Entry[],
    ready: false,
    // Routine kept in the meta table (no schema change): which program new days default to,
    // and the push/pull/legs lists.
    program: FULL_BODY as string,
    split: structuredClone(DEFAULT_SPLIT) as Record<SplitDay, string[]>,
    // Programs you made (meta key "programs"), deleted ones included.
    customPrograms: [] as Program[],
    // Which kind of day each date was trained as, keyed by YYYY-MM-DD (meta keys "day:<date>").
    dayTypes: {} as Record<string, DayType>,
    // Exercises skipped on a date, keyed by YYYY-MM-DD (meta keys "skip:<date>").
    skips: {} as Record<string, string[]>,
    machineMax: {} as MachineMax,
    // What the AI said about exercises added with "Ask AI" (meta key "exerciseInfo").
    exerciseInfo: {} as Record<string, AiExercise>
  }),

  getters: {
    // Original order of first appearance (assessment order), then newly added exercises.
    exercises: (s) => {
      const list = Array.from(
        new Set([...s.entries].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).map((e) => e.exercise))
      )
      // Make sure every alternative shows up, right after its sibling.
      return withAlternatives(list)
    },

    // Latest date each exercise was logged (YYYY-MM-DD).
    lastDone: (s) => {
      const out: Record<string, string> = {}
      for (const e of s.entries) if (!out[e.exercise] || e.date > out[e.exercise]) out[e.exercise] = e.date
      return out
    },

    // Training slots in order: alternatives (either/or) share one slot.
    slots(): string[][] {
      return slotsOf(this.exercises)
    },

    // Every program, built-in first. Includes deleted ones so old dates still resolve.
    allPrograms(): Program[] {
      return [
        { id: FULL_BODY, name: 'Full body', days: [{ id: 'full', name: 'Full body', exercises: this.exercises }] },
        { id: PPL, name: 'Push / Pull / Legs', days: SPLIT_DAYS.map((d) => ({ id: d, name: DAY_LABELS[d], exercises: this.split[d] })) },
        ...this.customPrograms
      ]
    },

    programs(): Program[] {
      return this.allPrograms.filter((p) => !p.deleted)
    },

    programById() {
      return (id: string) => this.allPrograms.find((p) => p.id === id)
    },

    dayOf() {
      return (type: DayType): ProgramDay | undefined => {
        const p = this.programById(programOfDay(type))
        return p?.days.find((d) => dayKey(p.id, d.id) === type)
      }
    },

    // Name shown for a date's day type. A program with one day is shown by the program's name.
    dayLabel() {
      return (type: DayType) => {
        const p = this.programById(programOfDay(type))
        const day = this.dayOf(type)
        if (!p || !day) return p?.name ?? ''
        return p.days.filter((d) => !d.deleted).length > 1 || isBuiltIn(p.id) ? day.name : p.name
      }
    },

    // Exercises planned for a kind of day: full body = everything, in training order.
    planFor() {
      // Every alternative is offered, and within an either/or slot the one done most recently
      // comes first, so the day starts on the one you actually use.
      return (type: DayType) => {
        const list = withAlternatives(this.dayOf(type)?.exercises ?? this.exercises)
        const rank = (n: string) => this.lastDone[n] ?? ''
        return slotsOf(list).flatMap((slot) =>
          [...slot].sort((a, b) => (rank(a) === rank(b) ? 0 : rank(a) > rank(b) ? -1 : 1))
        )
      }
    },

    // Day of a program that follows the most recent logged day of that program before `date`.
    nextDay() {
      return (date: string, programId: string): DayType => {
        const p = this.programById(programId) ?? this.allPrograms[0]
        const days = p.days.filter((d) => !d.deleted)
        const prev = this.sessions.find((s) => s.date < date && this.dayTypes[s.date] && programOfDay(this.dayTypes[s.date]) === p.id)
        const i = prev ? days.findIndex((d) => dayKey(p.id, d.id) === this.dayTypes[prev.date]) : -1
        return dayKey(p.id, days[(i + 1) % days.length].id)
      }
    },

    // Day type for a date: what was picked for it, else the next day of the current program.
    dayTypeFor() {
      return (date: string): DayType => {
        if (this.dayTypes[date]) return this.dayTypes[date]
        const current = this.programs.find((p) => p.id === this.program)
        return this.nextDay(date, current?.id ?? FULL_BODY)
      }
    },

    // Every exercise name you know: logged ones plus any only in a program.
    knownExercises(): string[] {
      const all = new Set(this.exercises)
      for (const p of this.allPrograms) for (const d of p.days) d.exercises.forEach((e) => all.add(e))
      return [...all]
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

    // Dates (newest first) this exercise was logged at or above its machine max.
    datesAtMax() {
      return (name: string): string[] => {
        const max = this.machineMax[name]
        if (!max) return []
        const maxKg = toKg(max.weight, max.unit)
        // 0.1 kg slack so a lbs log vs a kg max still counts after rounding.
        return [...new Set(this.byExercise(name).filter((e) => toKg(e.weight, e.unit) >= maxKg - 0.1).map((e) => e.date))]
      }
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
      this.applyRoutine((await db.meta.get('routine'))?.value as Routine | undefined)
      this.customPrograms = ((await db.meta.get('programs'))?.value as Program[]) ?? []
      await this.addStarterPrograms()
      this.machineMax = ((await db.meta.get('machineMax'))?.value as MachineMax) ?? {}
      // Built fresh so a reload after an account sync also drops dates removed elsewhere.
      const dayTypes: Record<string, DayType> = {}
      for (const m of await db.meta.where('key').startsWith('day:').toArray()) dayTypes[m.key.slice(4)] = m.value as DayType
      this.dayTypes = dayTypes
      const skips: Record<string, string[]> = {}
      for (const m of await db.meta.where('key').startsWith('skip:').toArray()) skips[m.key.slice(5)] = m.value as string[]
      this.skips = skips
      this.exerciseInfo = ((await db.meta.get('exerciseInfo'))?.value as Record<string, AiExercise>) ?? {}
      this.ready = true
    },

    // Each ready-made program is added once; after that it's yours to edit or delete.
    async addStarterPrograms() {
      const db = useDb()
      for (const p of STARTER_PROGRAMS) {
        const key = `starter:${p.id}`
        if (await db.meta.get(key)) continue
        if (!this.customPrograms.some((x) => x.id === p.id)) {
          this.customPrograms.push(structuredClone(p))
          await this.savePrograms()
        }
        await db.meta.put({ key, value: true })
      }
    },

    async saveExerciseInfo(name: string, info: AiExercise) {
      this.exerciseInfo[name] = info
      await useDb().meta.put({ key: 'exerciseInfo', value: structuredClone(toRaw(this.exerciseInfo)) })
    },

    async add(entry: Entry) {
      const id = await useDb().entries.add(entry)
      this.entries.push({ ...entry, id })
    },

    // Routines saved before custom programs only have `mode`.
    applyRoutine(routine: Routine | undefined) {
      if (routine?.program) this.program = routine.program
      else if (routine?.mode) this.program = routine.mode === 'split' ? PPL : FULL_BODY
      if (routine?.split) {
        for (const d of SPLIT_DAYS) if (routine.split[d]) this.split[d] = withDefaults(routine.split[d], DEFAULT_SPLIT[d])
      }
    },

    routineValue(): Routine {
      return { program: this.program, mode: this.program === FULL_BODY ? 'full' : 'split', split: structuredClone(toRaw(this.split)) }
    },

    async saveRoutine() {
      await useDb().meta.put({ key: 'routine', value: this.routineValue() })
    },

    async savePrograms() {
      await useDb().meta.put({ key: 'programs', value: structuredClone(toRaw(this.customPrograms)) })
    },

    // Pick the kind of day for a date. Its program also becomes the default for new days.
    async setDayType(date: string, type: DayType) {
      this.dayTypes[date] = type
      this.program = programOfDay(type)
      await useDb().meta.put({ key: `day:${date}`, value: type })
      await this.saveRoutine()
    },

    // Skip an exercise for one date, or take the skip back.
    async toggleSkip(date: string, exercise: string) {
      const list = this.skips[date] ?? []
      const next = list.includes(exercise) ? list.filter((n) => n !== exercise) : [...list, exercise]
      if (next.length) this.skips[date] = next
      else delete this.skips[date]
      if (next.length) await useDb().meta.put({ key: `skip:${date}`, value: [...next] })
      else await useDb().meta.delete(`skip:${date}`)
    },

    // weight undefined clears the max for that exercise.
    async setMachineMax(exercise: string, weight: number | undefined, unit: Unit) {
      if (weight && weight > 0) this.machineMax[exercise] = { weight, unit }
      else delete this.machineMax[exercise]
      await useDb().meta.put({ key: 'machineMax', value: structuredClone(toRaw(this.machineMax)) })
    },

    // A brand-new exercise logged on a day joins that day's list (full body lists everything already).
    async addToDay(type: DayType, exercise: string) {
      const programId = programOfDay(type)
      if (programId === FULL_BODY) return
      if (programId === PPL) {
        const list = this.split[type as SplitDay]
        if (list.includes(exercise)) return
        list.push(exercise)
        await this.saveRoutine()
        return
      }
      const day = this.dayOf(type)
      if (!day || day.exercises.includes(exercise)) return
      day.exercises.push(exercise)
      await this.savePrograms()
    },

    // Adds or replaces one of your programs.
    async saveProgram(program: Program) {
      const copy = structuredClone(toRaw(program))
      const i = this.customPrograms.findIndex((p) => p.id === copy.id)
      if (i >= 0) this.customPrograms[i] = copy
      else this.customPrograms.push(copy)
      await this.savePrograms()
    },

    // Is any date (logged or just picked) set to this program, or to one day of it?
    isUsed(programId: string, dayId?: string) {
      return Object.values(this.dayTypes).some((t) => (dayId ? t === dayKey(programId, dayId) : programOfDay(t) === programId))
    },

    // A program past dates point to is hidden, not removed, so those dates keep their day type.
    async deleteProgram(id: string) {
      if (this.isUsed(id)) {
        const p = this.customPrograms.find((x) => x.id === id)
        if (p) p.deleted = true
      } else {
        this.customPrograms = this.customPrograms.filter((p) => p.id !== id)
      }
      await this.savePrograms()
      if (this.program === id) {
        this.program = FULL_BODY
        await this.saveRoutine()
      }
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
    // Meals, foods, machine maxes, programs, day types and skips are only replaced when the file
    // has them, so an older backup leaves those alone.
    async importJson(json: string) {
      const data = parseBackup(json)
      const db = useDb()
      const strip = <T extends { id?: number }>(list: T[]) => list.map(({ id, ...rest }) => rest as T)
      await db.transaction('rw', [db.entries, db.meals, db.foods, db.meta, db.synced], async () => {
        // Forget what was last synced, so the next account sync merges this backup with the
        // cloud copy instead of treating everything missing from it as deleted.
        await db.synced.clear()
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
        if (data.programs) await db.meta.put({ key: 'programs', value: data.programs })
        if (data.routine) await db.meta.put({ key: 'routine', value: data.routine })
        if (data.dayTypes) {
          await db.meta.where('key').startsWith('day:').delete()
          await db.meta.bulkPut(Object.entries(data.dayTypes).map(([date, type]) => ({ key: `day:${date}`, value: type })))
        }
        if (data.skips) {
          await db.meta.where('key').startsWith('skip:').delete()
          await db.meta.bulkPut(Object.entries(data.skips).map(([date, list]) => ({ key: `skip:${date}`, value: list })))
        }
      })
      if (data.machineMax) {
        this.machineMax = { ...data.machineMax }
        await db.meta.put({ key: 'machineMax', value: { ...data.machineMax } })
      }
      if (data.programs) this.customPrograms = data.programs
      if (data.routine) this.applyRoutine(data.routine)
      if (data.dayTypes) this.dayTypes = { ...data.dayTypes }
      if (data.skips) this.skips = { ...data.skips }
      this.entries = await db.entries.toArray()
      return data
    },

    async exportJson() {
      const db = useDb()
      const [meals, foods] = await Promise.all([db.meals.toArray(), db.foods.toArray()])
      return JSON.stringify(
        {
          app: 'workout-log',
          version: 2,
          entries: this.entries,
          meals,
          foods,
          programs: toRaw(this.customPrograms),
          dayTypes: toRaw(this.dayTypes),
          skips: toRaw(this.skips),
          machineMax: toRaw(this.machineMax),
          routine: this.routineValue()
        },
        null,
        2
      )
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
