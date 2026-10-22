// Shapes the Claude fill route returns. Shared by server/api/ai/fill.ts and the app.
import type { Nutrients } from './nutrition'
import type { SplitDay } from './exercises'

export type AiKind = 'food' | 'exercise'

export interface AiFood {
  name: string
  ar: string // Arabic name, empty when there isn't a common one
  per100: Nutrients // per 100 g as eaten
  servingG: number // a typical serving in grams
  servingLabel: string // "plate", "piece", "cup"…
  note: string // assumptions Claude made, shown before saving
}

export type Equipment = 'machine' | 'cable' | 'dumbbells' | 'barbell' | 'bodyweight' | 'other'

export interface AiExercise {
  name: string // tidied name in the app's style, e.g. "Bulgarian Split Squat — Dumbbells"
  splitDay: SplitDay
  muscles: string[] // main muscles first
  equipment: Equipment
  perDumbbell: boolean // weight is entered per dumbbell
  tip: string // one short form cue
}
