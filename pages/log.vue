<script setup lang="ts">
import type { Unit } from '~/utils/units'
import { toKg, toLbs } from '~/utils/units'

const store = useWorkoutStore()
const today = new Date().toISOString().slice(0, 10)

const form = reactive({
  date: today,
  bodyWeightKg: store.latestBodyWeight as number | undefined,
  exercise: '',
  custom: '',
  weight: undefined as number | undefined,
  unit: 'lbs' as Unit,
  sets: 3,
  reps: 10,
  perDumbbell: false
})

// Exercises already logged on the selected day are hidden, so the list = what is left to do.
const doneToday = computed(
  () => new Set(store.verified.filter((e) => e.date === form.date).map((e) => e.exercise))
)
const remaining = computed(() => store.exercises.filter((e) => !doneToday.value.has(e)))
const done = computed(() => store.exercises.filter((e) => doneToday.value.has(e)))

watch(
  remaining,
  (list) => {
    if (!list.includes(form.exercise)) form.exercise = list[0] ?? ''
  },
  { immediate: true }
)

const name = computed(() => form.custom.trim() || form.exercise)
const last = computed(() => store.byExercise(name.value)[0])

// Pre-fill unit / per-dumbbell from the last time this exercise was logged.
watch(last, (l) => {
  if (!l) return
  form.unit = l.unit
  form.perDumbbell = !!l.perDumbbell
})

const preview = computed(() => {
  if (!form.weight) return ''
  return form.unit === 'lbs' ? `≈ ${toKg(form.weight, 'lbs')} kg` : `≈ ${toLbs(form.weight, 'kg')} lbs`
})
const lastWhen = computed(() => {
  if (!last.value) return ''
  const days = Math.round(
    (new Date(form.date + 'T00:00:00').getTime() - new Date(last.value.date + 'T00:00:00').getTime()) / 86400000
  )
  const d = new Date(last.value.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return days > 0 ? `${d} · ${days} day${days === 1 ? '' : 's'} ago` : d
})

function useLast() {
  const l = last.value
  if (!l) return
  form.weight = l.weight
  form.unit = l.unit
  form.perDumbbell = !!l.perDumbbell
  if (l.sets) form.sets = l.sets
  if (l.reps) form.reps = l.reps
}

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

const input = 'block w-full min-w-0 appearance-none rounded-lg bg-slate-900 border border-slate-700 px-3 py-2'
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <h1 class="text-2xl font-bold">Log a set</h1>

    <div class="grid grid-cols-2 gap-3">
      <label class="min-w-0 text-sm text-slate-400">Date<input v-model="form.date" type="date" :class="input" /></label>
      <label class="min-w-0 text-sm text-slate-400">Body weight (kg)
        <input v-model.number="form.bodyWeightKg" type="number" step="0.1" inputmode="decimal" :class="input" />
      </label>
    </div>

    <label class="block text-sm text-slate-400">
      Exercise
      <span class="float-right text-emerald-400">{{ remaining.length }} left · {{ done.length }} done</span>
      <select v-model="form.exercise" :disabled="!remaining.length" :class="input">
        <option v-if="!remaining.length" value="">All done for this day ✓</option>
        <option v-for="e in remaining" :key="e" :value="e">{{ e }}</option>
      </select>
    </label>
    <label class="block text-sm text-slate-400">…or a new exercise
      <input v-model="form.custom" placeholder="e.g. Calf Raise" :class="input" />
    </label>

    <section v-if="last" class="rounded-xl border border-slate-700 bg-slate-900 p-3">
      <p class="text-xs uppercase tracking-wide text-slate-500">Last time · {{ lastWhen }}</p>
      <p class="mt-1 text-lg text-emerald-400">
        {{ last.weight }} {{ last.unit }}
        <span class="text-slate-400">≈ {{ last.unit === 'lbs' ? toKg(last.weight, 'lbs') + ' kg' : toLbs(last.weight, 'kg') + ' lbs' }}</span>
        <span v-if="last.perDumbbell" class="text-xs text-slate-400"> each</span>
      </p>
      <p v-if="last.sets && last.reps" class="text-sm text-slate-300">{{ last.sets }} sets × {{ last.reps }} reps</p>
      <p v-else class="text-sm text-slate-500">Baseline weight, no sets or reps recorded</p>
      <button type="button" class="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm active:bg-slate-700" @click="useLast">
        Continue from this
      </button>
    </section>
    <p v-else-if="name" class="rounded-xl bg-slate-900 p-3 text-sm text-slate-500">No previous log for this exercise.</p>

    <div class="grid grid-cols-3 gap-3">
      <label class="col-span-2 min-w-0 text-sm text-slate-400">Weight
        <input
          v-model.number="form.weight"
          type="number"
          step="0.5"
          inputmode="decimal"
          required
          :placeholder="last ? `last: ${last.weight} ${last.unit}` : ''"
          :class="input"
        />
      </label>
      <label class="min-w-0 text-sm text-slate-400">Unit
        <select v-model="form.unit" :class="input"><option>lbs</option><option>kg</option></select>
      </label>
    </div>
    <p v-if="preview" class="-mt-2 text-sm text-emerald-400">{{ preview }}</p>

    <div class="grid grid-cols-2 gap-3">
      <label class="min-w-0 text-sm text-slate-400">Sets<input v-model.number="form.sets" type="number" inputmode="numeric" :class="input" /></label>
      <label class="min-w-0 text-sm text-slate-400">Reps<input v-model.number="form.reps" type="number" inputmode="numeric" :class="input" /></label>
    </div>

    <label class="flex items-center gap-2 text-sm text-slate-400">
      <input v-model="form.perDumbbell" type="checkbox" /> Weight is per dumbbell
    </label>

    <button class="w-full rounded-lg bg-emerald-600 py-3 font-semibold active:bg-emerald-700">Save</button>
    <p v-if="saved" class="text-center text-emerald-400">{{ saved }}</p>

    <section v-if="done.length" class="rounded-xl bg-slate-900 p-3">
      <p class="mb-2 text-sm text-slate-400">Done on this date</p>
      <ul class="flex flex-wrap gap-2">
        <li v-for="e in done" :key="e" class="rounded-full bg-emerald-900 px-3 py-1 text-xs text-emerald-300">✓ {{ e }}</li>
      </ul>
    </section>
  </form>
</template>
