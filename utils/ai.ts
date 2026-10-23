// What an AI app fills in for a new food or exercise, and how the app asks for it.
import type { Nutrients } from './nutrition'
import type { SplitDay } from './exercises'

export interface AiFood {
  name: string
  ar: string // Arabic name, empty when there isn't a common one
  per100: Nutrients // per 100 g as eaten
  servingG: number // a typical serving in grams
  servingLabel: string // "plate", "piece", "cup"…
  note: string // assumptions the AI made, shown before saving
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

// ---- Asking an AI app ----
// The question goes to the user's AI app through the share sheet; the user copies its reply back
// and the app reads the JSON in it. Nothing is sent anywhere by this app itself.

export function foodPrompt(name: string) {
  return `I'm logging food in my diet app (I live in Egypt). Give me the nutrition for: "${name}".
Values per 100 g as eaten (cooked where that applies), sodium in mg, the rest in grams. Use USDA averages for plain foods and a typical home recipe for dishes.
Reply with only this JSON, filled in:
{"name": "clear English name", "ar": "usual Egyptian Arabic name, or empty", "per100": {"kcal": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "sugar": 0, "sodium": 0}, "servingG": 0, "servingLabel": "plate, piece, cup…", "note": "one short sentence on what you assumed"}`
}

export function exercisePrompt(name: string) {
  return `I'm logging a gym exercise in my workout app with a push / pull / legs split: "${name}".
Push = chest, shoulders, triceps. Pull = back, rear delts, biceps. Legs = legs, glutes, calves, core.
Reply with only this JSON, filled in:
{"name": "tidy name, with \\" — \\" and the equipment when it matters, e.g. \\"Hammer Curl — Dumbbells\\"", "splitDay": "push | pull | legs", "muscles": ["main muscle first"], "equipment": "machine | cable | dumbbells | barbell | bodyweight | other", "perDumbbell": true or false (true only when the weight is one dumbbell per hand), "tip": "one short form cue"}`
}

// Finds the first {...} in the AI's reply (it may wrap it in a code block or add a sentence).
function jsonIn(text: string): any {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error("Couldn't find the AI's answer in that text. Copy the whole reply and try again.")
  try {
    return JSON.parse(text.slice(start, end + 1).replace(/[“”]/g, '"'))
  } catch {
    throw new Error("The answer wasn't in the expected format. Ask the AI to reply with only the JSON.")
  }
}

const num = (v: unknown, max: number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && isFinite(n) ? Math.min(Math.max(n, 0), max) : 0
}
const round1 = (v: number) => Math.round(v * 10) / 10

export function parseFood(text: string): AiFood {
  const d = jsonIn(text)
  const p = d.per100 ?? d
  if (p.kcal == null) throw new Error('No calories in that answer. Copy the whole reply and try again.')
  return {
    name: String(d.name ?? '').slice(0, 80),
    ar: String(d.ar ?? '').slice(0, 80),
    per100: {
      kcal: Math.round(num(p.kcal, 900)),
      protein: round1(num(p.protein, 100)),
      carbs: round1(num(p.carbs, 100)),
      fat: round1(num(p.fat, 100)),
      fiber: round1(num(p.fiber, 100)),
      sugar: round1(num(p.sugar, 100)),
      sodium: Math.round(num(p.sodium, 40000))
    },
    servingG: Math.round(num(d.servingG, 2000)),
    servingLabel: String(d.servingLabel ?? '').slice(0, 30),
    note: String(d.note ?? '').slice(0, 240)
  }
}

const EQUIPMENT_KEYS: Equipment[] = ['machine', 'cable', 'dumbbells', 'barbell', 'bodyweight', 'other']

export function parseExercise(text: string): AiExercise {
  const d = jsonIn(text)
  if (!d.name) throw new Error('No exercise name in that answer. Copy the whole reply and try again.')
  const day = String(d.splitDay ?? '').toLowerCase()
  const eq = String(d.equipment ?? '').toLowerCase() as Equipment
  return {
    name: String(d.name).slice(0, 80),
    splitDay: day === 'pull' || day === 'legs' ? day : 'push',
    muscles: Array.isArray(d.muscles) ? d.muscles.map(String).slice(0, 5) : [],
    equipment: EQUIPMENT_KEYS.includes(eq) ? eq : 'other',
    perDumbbell: d.perDumbbell === true || d.perDumbbell === 'true',
    tip: String(d.tip ?? '').slice(0, 200)
  }
}
