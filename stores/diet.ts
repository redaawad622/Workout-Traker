import { defineStore } from 'pinia'
import type { CustomFood, Meal } from '~/utils/db'
import { FOODS, type Food } from '~/utils/foods'
import { defaultGoals, scale, sum, type DietGoals } from '~/utils/nutrition'

export const mealTotals = (m: Meal) => scale(m.per100, m.grams)

export const useDietStore = defineStore('diet', {
  state: () => ({ meals: [] as Meal[], foods: [] as CustomFood[], goals: null as DietGoals | null, ready: false }),

  getters: {
    // Custom foods first so they win over a built-in with the same name.
    allFoods: (s): Food[] => [...s.foods.map((f) => ({ ...f, custom: true })), ...FOODS],

    byDate: (s) => (date: string) => s.meals.filter((m) => m.date === date).sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),

    totalsFor() {
      return (date: string) => sum(this.byDate(date).map(mealTotals))
    },

    // Foods logged before, most recent first, for one-tap re-adding.
    recent(): Food[] {
      const seen = new Set<string>()
      const out: Food[] = []
      for (const m of [...this.meals].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))) {
        if (seen.has(m.name)) continue
        seen.add(m.name)
        const known = this.allFoods.find((f) => f.name === m.name)
        out.push(known ?? { name: m.name, per100: m.per100, servingG: m.servingG, servingLabel: m.servingLabel, perServing: m.perServing })
        if (out.length >= 12) break
      }
      return out
    }
  },

  actions: {
    async load(bodyWeightKg?: number) {
      const db = useDb()
      const [meals, foods, goals] = await Promise.all([db.meals.toArray(), db.foods.toArray(), db.meta.get('dietGoals')])
      this.meals = meals
      this.foods = foods
      this.goals = (goals?.value as DietGoals) ?? defaultGoals(bodyWeightKg)
      this.ready = true
    },

    async add(meal: Meal) {
      const id = await useDb().meals.add(meal)
      this.meals.push({ ...meal, id })
    },

    async update(id: number, changes: Partial<Meal>) {
      await useDb().meals.update(id, changes)
      const m = this.meals.find((x) => x.id === id)
      if (m) Object.assign(m, changes)
    },

    async remove(id: number) {
      await useDb().meals.delete(id)
      this.meals = this.meals.filter((m) => m.id !== id)
    },

    async addFood(food: CustomFood) {
      const id = await useDb().foods.add(food)
      const saved = { ...food, id }
      this.foods.push(saved)
      return saved
    },

    async removeFood(id: number) {
      await useDb().foods.delete(id)
      this.foods = this.foods.filter((f) => f.id !== id)
    },

    async saveGoals(goals: DietGoals) {
      await useDb().meta.put({ key: 'dietGoals', value: { ...goals } })
      this.goals = { ...goals }
    }
  }
})
