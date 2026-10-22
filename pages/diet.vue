<script setup lang="ts">
import type { Meal } from '~/utils/db'
import { fmtDay, relativeDay, todayISO } from '~/utils/format'
import { defaultGoals, fmtN, fmtQty, plural, slotForNow, SLOTS, sum, type DietGoals, type MealSlot } from '~/utils/nutrition'
import { mealTotals, useDietStore } from '~/stores/diet'

const store = useWorkoutStore()
const diet = useDietStore()

const date = ref(todayISO())
const meals = computed(() => diet.byDate(date.value))
const totals = computed(() => diet.totalsFor(date.value))
const goals = computed(() => diet.goals ?? defaultGoals(store.latestBodyWeight))

const slots = computed(() =>
  SLOTS.map((s) => {
    const items = meals.value.filter((m) => m.slot === s.key)
    return { ...s, items, kcal: Math.round(sum(items.map(mealTotals)).kcal) }
  })
)

const kcalLeft = computed(() => Math.round(goals.value.kcal - totals.value.kcal))
const pct = (v: number, goal: number) => Math.min(100, goal ? (v / goal) * 100 : 0)
const macros = computed(() => [
  { key: 'protein' as const, label: 'Protein', value: totals.value.protein, goal: goals.value.protein },
  { key: 'carbs' as const, label: 'Carbs', value: totals.value.carbs, goal: goals.value.carbs },
  { key: 'fat' as const, label: 'Fat', value: totals.value.fat, goal: goals.value.fat }
])

const amountText = (m: Meal) => {
  if (m.servings == null) return `${fmtQty(m.grams)} g`
  const s = `${fmtQty(m.servings)} ${plural(m.servingLabel ?? 'serving', m.servings)}`
  return m.perServing ? s : `${s} · ${fmtQty(m.grams)} g`
}

// Sheet
const sheet = ref<{ slot: MealSlot; meal?: Meal } | null>(null)
const add = (slot: MealSlot = slotForNow()) => (sheet.value = { slot })
const edit = (meal: Meal) => (sheet.value = { slot: meal.slot, meal })

const saved = ref('')
let savedTimer: ReturnType<typeof setTimeout> | undefined
function flash(text: string) {
  saved.value = text
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => (saved.value = ''), 2500)
}

// Goals
const editingGoals = ref<DietGoals | null>(null)
const goalFields: { key: keyof DietGoals; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' }
]
async function saveGoals() {
  const g = editingGoals.value!
  for (const f of goalFields) g[f.key] = Math.max(0, Number(g[f.key]) || 0)
  await diet.saveGoals(g)
  editingGoals.value = null
  flash('Goals saved')
}
</script>

<template>
  <div v-if="diet.ready" class="flex flex-col gap-5 pb-4">
    <!-- Date -->
    <div class="flex items-center justify-between gap-3">
      <label class="relative flex min-h-11 items-center gap-2">
        <span class="text-[22px] font-medium">{{ relativeDay(date) }}</span>
        <span class="text-sm text-neutral-400">{{ fmtDay(date) }}</span>
        <i class="ph ph-caret-down text-neutral-500" />
        <input v-model="date" type="date" required aria-label="Date" class="absolute inset-0 opacity-0" />
      </label>
      <button type="button" class="flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-neutral-300 shadow-sm active:bg-neutral-900" @click="editingGoals = { ...goals }">
        <i class="ph ph-target" />Goals
      </button>
    </div>

    <!-- Day totals -->
    <div class="card flex flex-col gap-4 p-[18px]">
      <div class="flex items-end justify-between gap-3">
        <div class="tnum flex flex-col gap-1">
          <span class="label">Eaten</span>
          <span class="text-[44px] font-medium leading-none tracking-[-0.02em]">
            {{ Math.round(totals.kcal) }}<span class="ml-1.5 text-base font-normal tracking-normal text-neutral-400">/ {{ goals.kcal }} kcal</span>
          </span>
        </div>
        <span class="tnum pb-1 text-right text-sm" :class="kcalLeft >= 0 ? 'text-accent-300' : 'text-warn-text'">
          {{ kcalLeft >= 0 ? `${kcalLeft} left` : `${-kcalLeft} over` }}
        </span>
      </div>
      <div class="h-2 overflow-hidden rounded-[4px] bg-neutral-900">
        <div class="h-full rounded-[4px]" :class="kcalLeft >= 0 ? 'bg-accent' : 'bg-warn'" :style="{ width: `${pct(totals.kcal, goals.kcal)}%` }" />
      </div>

      <div class="grid grid-cols-3 gap-3 pt-1">
        <div v-for="m in macros" :key="m.key" class="tnum flex flex-col gap-1.5">
          <span class="text-xs text-neutral-400">{{ m.label }}</span>
          <span class="text-[17px] font-medium">{{ fmtN(m.value, m.key) }}<span class="text-[13px] font-normal text-neutral-400"> / {{ m.goal }} g</span></span>
          <div class="h-1.5 overflow-hidden rounded-[3px] bg-neutral-900">
            <div class="h-full rounded-[3px]" :class="m.key === 'protein' ? 'bg-accent' : 'bg-accent-600'" :style="{ width: `${pct(m.value, m.goal)}%` }" />
          </div>
        </div>
      </div>

      <div class="tnum flex flex-wrap gap-x-4 gap-y-1 pt-3 text-[13px] text-neutral-400 shadow-[0_-1px_0_theme(colors.neutral.800)]">
        <span>Fiber <span class="text-neutral-200">{{ fmtN(totals.fiber, 'fiber') }}</span> / {{ goals.fiber }} g</span>
        <span>Sugar <span class="text-neutral-200">{{ fmtN(totals.sugar, 'sugar') }} g</span></span>
        <span>Sodium <span :class="totals.sodium > 2300 ? 'text-warn-text' : 'text-neutral-200'">{{ fmtN(totals.sodium, 'sodium') }}</span> / 2300 mg</span>
      </div>
    </div>

    <!-- Meals -->
    <section v-for="s in slots" :key="s.key" class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-2 text-base font-medium">
          <i :class="`ph ph-${s.icon}`" class="text-lg text-accent-400" />{{ s.label }}
        </span>
        <span class="tnum text-[13px] text-neutral-400">{{ s.items.length ? `${s.kcal} kcal` : '' }}</span>
      </div>
      <ul v-if="s.items.length" class="tnum rounded-lg px-3.5 shadow-sm">
        <li v-for="(m, i) in s.items" :key="m.id" :class="i < s.items.length - 1 && 'shadow-hairline-dim'">
          <button type="button" class="flex min-h-14 w-full items-center gap-3 py-2 text-left" @click="edit(m)">
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[15px]">{{ m.name }}</span>
              <span class="text-xs text-neutral-400">{{ amountText(m) }} · P {{ fmtN(mealTotals(m).protein, 'protein') }} · C {{ fmtN(mealTotals(m).carbs, 'carbs') }} · F {{ fmtN(mealTotals(m).fat, 'fat') }}</span>
            </span>
            <span class="flex-none text-sm text-neutral-200">{{ Math.round(mealTotals(m).kcal) }}</span>
          </button>
        </li>
      </ul>
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-md text-sm text-neutral-300 shadow-[inset_0_0_0_1px_theme(colors.neutral.800)] active:bg-neutral-900"
        @click="add(s.key)"
      >
        <i class="ph ph-plus" />Add to {{ s.label.toLowerCase() }}
      </button>
    </section>

    <p class="text-xs leading-normal text-neutral-500">
      Values are typical averages per 100 g. Home recipes vary, so treat totals as a close estimate. Add your own foods from a label for exact numbers.
    </p>

    <!-- Toast -->
    <Transition enter-from-class="translate-y-2 opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-200" leave-active-class="transition duration-300">
      <div
        v-if="saved"
        role="status"
        class="fixed inset-x-5 z-20 mx-auto flex h-11 max-w-[calc(42rem-40px)] items-center gap-2 rounded-md bg-neutral-900 px-3.5 text-sm shadow-md"
        style="bottom: calc(var(--tabbar) + 16px)"
      >
        <i class="ph-fill ph-check-circle text-lg text-accent-400" />{{ saved }}
      </div>
    </Transition>

    <FoodSheet v-if="sheet" :date="date" :slot="sheet.slot" :meal="sheet.meal" @close="sheet = null" @saved="flash" />

    <!-- Goals sheet -->
    <Teleport to="body">
      <template v-if="editingGoals">
        <div class="fixed inset-0 z-40 bg-[color-mix(in_srgb,theme(colors.bg)_70%,transparent)]" @click="editingGoals = null" />
        <form
          role="dialog"
          aria-label="Daily goals"
          class="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-t-sheet bg-surface px-5 pt-2.5 shadow-lg"
          style="padding-bottom: calc(env(safe-area-inset-bottom) + 20px)"
          @submit.prevent="saveGoals"
        >
          <span class="h-[5px] w-10 self-center rounded-sm bg-neutral-700" />
          <span class="text-xl font-medium">Daily goals</span>
          <label v-for="f in goalFields" :key="f.key" class="flex min-h-12 items-center justify-between gap-3 shadow-hairline-dim">
            <span class="text-[15px]">{{ f.label }}</span>
            <span class="tnum flex items-center gap-1.5 text-sm text-neutral-400">
              <input
                v-model.number="editingGoals[f.key]"
                type="number"
                inputmode="numeric"
                class="h-10 w-20 rounded-md bg-bg px-2.5 text-right text-[15px] text-ink shadow-sm focus:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span class="w-8">{{ f.unit }}</span>
            </span>
          </label>
          <p v-if="store.latestBodyWeight" class="text-xs text-neutral-500">
            Protein tip: 1.6–2.2 g per kg body weight while lifting ≈ {{ Math.round(store.latestBodyWeight * 1.6) }}–{{ Math.round(store.latestBodyWeight * 2.2) }} g for you.
          </p>
          <button class="mt-1 h-[52px] rounded-md text-base font-medium text-accent-300 shadow-[inset_0_0_0_1px_theme(colors.accent.DEFAULT)] active:bg-accent-900">Save goals</button>
        </form>
      </template>
    </Teleport>
  </div>
  <p v-else class="pt-4 text-neutral-400">Loading…</p>
</template>
