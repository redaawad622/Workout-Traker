import Dexie, { type Table } from 'dexie'
import type { Unit } from './units'

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
  source: EntrySource
}

export interface Meta {
  key: string
  value: unknown
}

class WorkoutDB extends Dexie {
  entries!: Table<Entry, number>
  meta!: Table<Meta, string>

  constructor() {
    super('workout-log')
    // Never change or remove an existing version: add a new this.version(n + 1) with an
    // .upgrade() instead, so logged data on people's devices survives app updates.
    this.version(1).stores({
      entries: '++id, date, exercise, source',
      meta: 'key'
    })
  }
}

let _db: WorkoutDB | null = null
export const useDb = () => (_db ??= new WorkoutDB())
