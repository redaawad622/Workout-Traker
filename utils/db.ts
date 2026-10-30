import Dexie, { type Table } from 'dexie'
import type { Unit } from './units'
import type { MealSlot, Nutrients } from './nutrition'

export type EntrySource = 'assessment' | 'logged' | 'unverified'

export interface Entry {
  id?: number
  date: string // YYYY-MM-DD
  exercise: string
  weight: number
  unit: Unit
  sets?: number
  reps?: number
  perDumbbell?: boolean
  bodyWeightKg?: number
  note?: string
  // Every rep done with good form, so next time goes up a step (not indexed, so no schema version).
  clean?: boolean
  at?: string // ISO time it was logged, set when logged on the day itself (not indexed, so no schema version)
  source: EntrySource
  uid?: string // stable id across devices, set on first cloud sync
}

export interface Meta {
  key: string
  value: unknown
}

// One food eaten at one meal. Nutrients per 100 g are copied from the food when logged,
// so editing or deleting a custom food later never changes past days.
export interface Meal {
  id?: number
  date: string // YYYY-MM-DD
  slot: MealSlot
  name: string
  grams: number
  servings?: number // set when logged by serving instead of grams
  servingG?: number
  servingLabel?: string
  perServing?: boolean // values are for one serving of unknown weight
  per100: Nutrients
  /** What it cost, when entered. */
  price?: number
  /** The expense it was sent to Money Tracker as, so editing the price updates that one. */
  moneyUid?: string
  uid?: string
}

// A food the user added themselves (built-in foods live in utils/foods.ts).
export interface CustomFood {
  id?: number
  name: string
  ar?: string // not indexed, so adding it needs no schema version
  per100: Nutrients
  servingG?: number
  servingLabel?: string
  perServing?: boolean
  uid?: string
}

// What a record looked like the last time this device and the cloud agreed on it
// (id is "<table>:<uid>"), so a sync can tell which side changed it since.
export interface Synced {
  id: string
  hash: string
}

class WorkoutDB extends Dexie {
  entries!: Table<Entry, number>
  meta!: Table<Meta, string>
  meals!: Table<Meal, number>
  foods!: Table<CustomFood, number>
  synced!: Table<Synced, string>

  constructor() {
    super('workout-log')
    // Never change or remove an existing version: add a new this.version(n + 1) with an
    // .upgrade() instead, so logged data on people's devices survives app updates.
    this.version(1).stores({
      entries: '++id, date, exercise, source',
      meta: 'key'
    })
    // v2: diet log. Adds tables only; existing data is untouched.
    this.version(2).stores({
      entries: '++id, date, exercise, source',
      meta: 'key',
      meals: '++id, date, name',
      foods: '++id, name'
    })
    // v3: optional account sync. Adds one bookkeeping table; existing data is untouched.
    this.version(3).stores({
      entries: '++id, date, exercise, source',
      meta: 'key',
      meals: '++id, date, name',
      foods: '++id, name',
      synced: 'id'
    })
  }
}

let _db: WorkoutDB | null = null
export const useDb = () => (_db ??= new WorkoutDB())
