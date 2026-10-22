<script setup lang="ts">
import type { Unit } from '~/utils/units'
import { toKg, toLbs } from '~/utils/units'

const store = useWorkoutStore()
const today = new Date().toISOString().slice(0, 10)

const form = reactive({
  date: today,
  bodyWeightKg: store.latestBodyWeight as number | undefined,
  exercise: store.exercises[0] ?? '',
  custom: '',
  weight: undefined as number | undefined,
  unit: 'lbs' as Unit,
  sets: 3,
  reps: 10,
  perDumbbell: false
})

const name = computed(() => form.custom.trim() || form.exercise)
const preview = computed(() => {
  if (!form.weight) return ''
  return form.unit === 'lbs' ? `≈ ${toKg(form.weight, 'lbs')} kg` : `≈ ${toLbs(form.weight, 'kg')} lbs`
})
const saved = ref('')

async function save() {
  if (!name.value || !form.weight) return
  await store.add({
    date: form.date,
    exercise: name.value,
    weight: form.weight,
    unit: form.unit,
    sets: form.sets,
    reps: form.reps,
    perDumbbell: form.perDumbbell || undefined,
    bodyWeightKg: form.bodyWeightKg,
    source: 'logged'
  })
  saved.value = `Saved ${name.value}`
  form.weight = undefined
  form.custom = ''
  setTimeout(() => (saved.value = ''), 2500)
}

const input = 'w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2'
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <h1 class="text-2xl font-bold">Log a set</h1>

    <div class="grid grid-cols-2 gap-3">
      <label class="text-sm text-slate-400">Date<input v-model="form.date" type="date" :class="input" /></label>
      <label class="text-sm text-slate-400">Body weight (kg)
        <input v-model.number="form.bodyWeightKg" type="number" step="0.1" inputmode="decimal" :class="input" />
      </label>
    </div>

    <label class="block text-sm text-slate-400">Exercise
      <select v-model="form.exercise" :class="input">
        <option v-for="e in store.exercises" :key="e" :value="e">{{ e }}</option>
      </select>
    </label>
    <label class="block text-sm text-slate-400">…or a new exercise
      <input v-model="form.custom" placeholder="e.g. Calf Raise" :class="input" />
    </label>

    <div class="grid grid-cols-3 gap-3">
      <label class="col-span-2 text-sm text-slate-400">Weight
        <input v-model.number="form.weight" type="number" step="0.5" inputmode="decimal" required :class="input" />
      </label>
      <label class="text-sm text-slate-400">Unit
        <select v-model="form.unit" :class="input"><option>lbs</option><option>kg</option></select>
      </label>
    </div>
    <p v-if="preview" class="-mt-2 text-sm text-emerald-400">{{ preview }}</p>

    <div class="grid grid-cols-2 gap-3">
      <label class="text-sm text-slate-400">Sets<input v-model.number="form.sets" type="number" inputmode="numeric" :class="input" /></label>
      <label class="text-sm text-slate-400">Reps<input v-model.number="form.reps" type="number" inputmode="numeric" :class="input" /></label>
    </div>

    <label class="flex items-center gap-2 text-sm text-slate-400">
      <input v-model="form.perDumbbell" type="checkbox" /> Weight is per dumbbell
    </label>

    <button class="w-full rounded-lg bg-emerald-600 py-3 font-semibold active:bg-emerald-700">Save</button>
    <p v-if="saved" class="text-center text-emerald-400">{{ saved }}</p>
  </form>
</template>
