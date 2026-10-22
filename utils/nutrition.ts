// Nutrient values. Foods store them per 100 g; meal totals are scaled by grams eaten.
export interface Nutrients {
  kcal: number
  protein: number // g
  carbs: number // g
  fat: number // g
  fiber: number // g
  sugar: number // g
  sodium: number // mg
}

export type NutrientKey = keyof Nutrients

export const NUTRIENTS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' }
]

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }

export function scale(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100
  const out = { ...ZERO }
  for (const { key } of NUTRIENTS) out[key] = (per100[key] ?? 0) * f
  return out
}

export function sum(list: Nutrients[]): Nutrients {
  const out = { ...ZERO }
  for (const n of list) for (const { key } of NUTRIENTS) out[key] += n[key] ?? 0
  return out
}

// Whole numbers for kcal/mg, one decimal under 10 g.
export const fmtN = (n: number, key: NutrientKey) =>
  key === 'kcal' || key === 'sodium' || n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const SLOTS: { key: MealSlot; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'coffee' },
  { key: 'lunch', label: 'Lunch', icon: 'bowl-food' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-stars' },
  { key: 'snack', label: 'Snacks', icon: 'cookie' }
]

// Slot that fits the current time of day, for the default when adding.
export function slotForNow(): MealSlot {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 22) return 'dinner'
  return 'snack'
}

export interface DietGoals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export function defaultGoals(bodyWeightKg?: number): DietGoals {
  return {
    kcal: 2200,
    // ~1.8 g per kg body weight is a common target while lifting.
    protein: bodyWeightKg ? Math.round(bodyWeightKg * 1.8) : 140,
    carbs: 250,
    fat: 70,
    fiber: 30
  }
}

// "2 eggs", "1.5 loaves" (labels are singular nouns or abbreviations)
export function plural(label: string, qty: number) {
  if (qty === 1 || /^(tbsp|tsp|g|ml)$/.test(label)) return label
  if (label.endsWith('f')) return label.slice(0, -1) + 'ves'
  if (/(ch|sh|s)$/.test(label)) return label + 'es'
  return label + 's'
}

export const fmtQty = (q: number) => String(Math.round(q * 100) / 100)
