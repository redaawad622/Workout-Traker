<script setup lang="ts">
import type { Unit } from '~/utils/units'
import type { Entry } from '~/utils/db'
import { alternativesOf, dayKey, programOfDay, slotsOf, type DayType } from '~/utils/exercises'
import { convertedFull, daysBetween, fixed1, fmtDay, kgOf, relativeDay, splitName, todayISO } from '~/utils/format'
import { MAX_SESSIONS_TO_SWITCH } from '~/stores/workout'

const store = useWorkoutStore()

const form = reactive({
  date: todayISO(),
  bodyWeightKg: store.latestBodyWeight as number | undefined,
  exercise: '',
  custom: '',
  weight: undefined as number | undefined,
  unit: 'lbs' as Unit,
  sets: 3,
  reps: 10,
  perDumbbell: false
})

// Kind of day for the selected date: what was picked for it, else the next day in the
// rotation of the current program.
const dayType = computed<DayType>(() => store.dayTypeFor(form.date))
const plan = computed(() => store.planFor(dayType.value))
const planSlots = computed(() => slotsOf(plan.value))

// Program picker: every live program, plus a deleted one if this date was trained on it.
const program = computed(() => store.programById(programOfDay(dayType.value)) ?? store.programs[0])
const programOptions = computed(() =>
  program.value.deleted ? [...store.programs, program.value] : store.programs
)
const dayOptions = computed(() =>
  program.value.days
    .filter((d) => !d.deleted || dayKey(program.value.id, d.id) === dayType.value)
    .map((d) => ({ type: dayKey(program.value.id, d.id), name: d.name }))
)
function pickProgram(id: string) {
  if (id !== program.value.id) store.setDayType(form.date, store.nextDay(form.date, id))
}

// Exercises already logged on the selected day are hidden, so the list = what is left to do.
const doneToday = computed(
  () => new Set(store.verified.filter((e) => e.date === form.date).map((e) => e.exercise))
)
// Alternatives of something already done today are also off the list (you do one OR the other).
const covered = computed(() => {
  const set = new Set(doneToday.value)
  for (const e of doneToday.value) alternativesOf(e).forEach((a) => set.add(a))
  return set
})
const remaining = computed(() => plan.value.filter((e) => !covered.value.has(e)))

// Chips in training order: done ones plus "skipped" alternatives.
const chips = computed(() =>
  store.exercises
    .filter((e) => covered.value.has(e))
    .map((e) => ({ name: e, skipped: !doneToday.value.has(e) }))
)
const skippedCount = computed(() => chips.value.filter((c) => c.skipped).length)

// Day progress by training slot (an either/or pair is one slot).
const slotState = computed(() =>
  planSlots.value.map((names) => (names.some((n) => doneToday.value.has(n)) ? 'done' : names.includes(name.value) ? 'current' : 'todo'))
)
const doneSlots = computed(() => slotState.value.filter((s) => s === 'done').length)
const leftSlots = computed(() => planSlots.value.length - doneSlots.value)
const currentSlot = computed(() => slotState.value.indexOf('current'))

watch(() => form.date, () => editing.value && stopEdit())

watch(
  remaining,
  (list) => {
    if (!list.includes(form.exercise)) form.exercise = list[0] ?? ''
  },
  { immediate: true }
)

// Tapping a done chip loads that entry into the form for editing.
const editing = ref<Entry | null>(null)

const name = computed(() => editing.value?.exercise ?? (form.custom.trim() || form.exercise))
const last = computed(() => store.byExercise(name.value).find((e) => e.id !== editing.value?.id))
const short = (n: string) => splitName(n)[0].replace(/ Machine$/, '')

const kicker = computed(() => {
  if (editing.value) return 'Editing'
  if (!last.value) return 'New exercise'
  return !form.custom && remaining.value.includes(name.value) ? 'Up next' : 'Extra'
})

// Pre-fill unit / per-dumbbell from the last time this exercise was logged.
watch(last, (l) => {
  if (!l || editing.value) return
  form.unit = l.unit
  form.perDumbbell = !!l.perDumbbell
})

const lastWhen = computed(() => {
  if (!last.value) return ''
  const days = daysBetween(last.value.date, form.date)
  return days > 0 ? `${fmtDay(last.value.date)} · ${days} day${days === 1 ? '' : 's'} ago` : fmtDay(last.value.date)
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

// Weight stepper. Empty weight shows last time's value as the placeholder; +/- start from it.
const step = computed(() => (form.unit === 'lbs' ? 5 : form.perDumbbell ? 1 : 2.5))
const placeholder = computed(() => (last.value && last.value.unit === form.unit ? last.value.weight : 0))
function nudge(dir: 1 | -1) {
  const base = form.weight ?? placeholder.value
  form.weight = Math.max(0, Math.round((base + dir * step.value) * 10) / 10)
}
const weightChars = computed(() => String(form.weight ?? placeholder.value).length)
const preview = computed(() => (form.weight ? `≈ ${convertedFull({ weight: form.weight, unit: form.unit })}` : ''))
const vsLast = computed(() => {
  const l = last.value
  if (!form.weight || !l) return null
  const diff = l.unit === form.unit ? form.weight - l.weight : kgOf({ weight: form.weight, unit: form.unit }) - kgOf(l)
  const r = Math.round(diff * 10) / 10
  const suffix = l.unit === form.unit ? '' : ' kg'
  if (r === 0) return { text: 'same as last', up: false }
  return { text: `${r > 0 ? '+' : '−'}${Math.abs(r)}${suffix} vs last`, up: r > 0 }
})

// Machine max: the heaviest the machine's stack goes. Doubles as the target.
const max = computed(() => store.machineMax[name.value])
const maxKg = computed(() => (max.value ? kgOf(max.value) : 0))
const lastPct = computed(() => (last.value && maxKg.value ? Math.min(100, Math.round((kgOf(last.value) / maxKg.value) * 100)) : 0))
const atMaxCount = computed(() => store.datesAtMax(name.value).length)
const atMaxNow = computed(() => !!form.weight && !!maxKg.value && kgOf({ weight: form.weight, unit: form.unit }) >= maxKg.value - 0.1)

const maxForm = reactive({ open: false, weight: undefined as number | undefined, unit: 'lbs' as Unit })
watch(name, () => (maxForm.open = false))
function editMax() {
  maxForm.weight = max.value?.weight
  maxForm.unit = max.value?.unit ?? form.unit
  maxForm.open = true
}
async function saveMax(weight = maxForm.weight) {
  await store.setMachineMax(name.value, weight, maxForm.unit)
  maxForm.open = false
}

const saved = ref('')
let savedTimer: ReturnType<typeof setTimeout> | undefined

function startEdit(exercise: string) {
  // Latest entry for this exercise on the selected day.
  const e = store.verified.find((x) => x.date === form.date && x.exercise === exercise)
  if (!e) return
  editing.value = e
  form.weight = e.weight
  form.unit = e.unit
  form.perDumbbell = !!e.perDumbbell
  form.sets = e.sets ?? 3
  form.reps = e.reps ?? 10
  if (e.bodyWeightKg) form.bodyWeightKg = e.bodyWeightKg
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function stopEdit() {
  editing.value = null
  form.weight = undefined
}

function flash(text: string) {
  saved.value = text
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => (saved.value = ''), 2500)
}

async function removeEditing() {
  const e = editing.value
  if (!e || !confirm(`Delete ${e.exercise} from ${fmtDay(e.date)}?`)) return
  await store.remove(e.id!)
  stopEdit()
  flash(`Deleted ${e.exercise}`)
}

async function save() {
  if (!name.value || !form.weight) return
  if (editing.value) {
    await store.update(editing.value.id!, {
      weight: form.weight,
      unit: form.unit,
      sets: form.sets,
      reps: form.reps,
      perDumbbell: form.perDumbbell || undefined,
      bodyWeightKg: form.bodyWeightKg
    })
    flash(`Updated ${name.value}`)
    stopEdit()
    return
  }
  // A brand-new exercise joins the day's list.
  if (!plan.value.includes(name.value) && !store.exercises.includes(name.value)) await store.addToDay(dayType.value, name.value)
  if (!store.dayTypes[form.date]) await store.setDayType(form.date, dayType.value)
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
  flash(`Saved ${name.value}`)
  form.weight = undefined
  form.custom = ''
}

// Picker sheet
const picking = ref(false)
const pickerRows = computed(() =>
  planSlots.value
    .map((names, i) => ({ n: i + 1, names: names.filter((x) => !covered.value.has(x)) }))
    .filter((r) => r.names.length)
)
function pick(n: string) {
  editing.value = null
  if (remaining.value.includes(n)) {
    form.exercise = n
    form.custom = ''
  } else {
    form.custom = n
  }
  form.weight = undefined
  picking.value = false
}

// All done for the day (until an extra exercise is picked).
const allDone = computed(() => !remaining.value.length && !form.custom && !editing.value)
const dayStats = computed(() => {
  const today = store.verified.filter((e) => e.date === form.date && e.source === 'logged')
  let heavier = 0, matched = 0, lighter = 0
  for (const e of today) {
    const prev = store.byExercise(e.exercise).find((p) => p.date < form.date)
    if (!prev) continue
    const d = Math.round((kgOf(e) - kgOf(prev)) * 10) / 10
    if (d > 0) heavier++
    else if (d === 0) matched++
    else lighter++
  }
  return {
    exercises: new Set(today.map((e) => e.exercise)).size,
    sets: today.reduce((n, e) => n + (e.sets ?? 0), 0),
    heavier,
    matched,
    lighter
  }
})

const segment = (s: string) =>
  s === 'done'
    ? 'bg-accent'
    : s === 'current'
      ? 'bg-neutral-700 shadow-[0_0_0_1px_theme(colors.accent.500)]'
      : 'bg-neutral-900'
</script>

<template>
  <div>
    <!-- All-done glow behind the page -->
    <div
      v-if="allDone"
      class="pointer-events-none fixed inset-0 bg-[radial-gradient(120%_60%_at_0%_20%,theme(colors.accent.900),transparent_70%)]"
    />

    <form class="relative flex flex-col pb-20" :class="allDone ? 'gap-[22px]' : 'gap-[18px]'" @submit.prevent="save">
      <!-- Date + body weight -->
      <div class="flex items-center justify-between gap-3">
        <label class="relative flex min-h-11 items-center gap-2">
          <span class="text-[22px] font-medium">{{ relativeDay(form.date) }}</span>
          <span class="text-sm text-neutral-400">{{ fmtDay(form.date) }}</span>
          <i class="ph ph-caret-down text-neutral-500" />
          <input v-model="form.date" type="date" required aria-label="Date" class="absolute inset-0 opacity-0" />
        </label>
        <label class="tnum flex h-10 items-center gap-1.5 rounded-md bg-surface px-3 text-sm shadow-sm focus-within:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]">
          <i class="ph ph-person-simple text-neutral-400" />
          <input
            v-model.number="form.bodyWeightKg"
            type="number"
            step="0.1"
            inputmode="decimal"
            aria-label="Body weight in kg"
            placeholder="—"
            class="w-10 bg-transparent text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />kg
        </label>
      </div>

      <!-- Program + kind of day -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-3">
          <label class="relative flex min-h-11 min-w-0 items-center gap-2">
            <i class="ph ph-barbell text-lg text-accent-400" />
            <span class="truncate text-[15px] font-medium">{{ program.name }}</span>
            <i class="ph ph-caret-down text-neutral-500" />
            <select
              :value="program.id"
              aria-label="Program"
              class="absolute inset-0 opacity-0"
              @change="pickProgram(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="p in programOptions" :key="p.id" :value="p.id">{{ p.name }}{{ p.deleted ? ' (deleted)' : '' }}</option>
            </select>
          </label>
          <NuxtLink to="/programs" class="flex h-11 flex-none items-center gap-1.5 text-sm text-neutral-400">
            <i class="ph ph-pencil-simple" />Programs
          </NuxtLink>
        </div>
        <div
          v-if="dayOptions.length > 1"
          class="flex gap-[3px] overflow-x-auto rounded-md bg-neutral-900 p-[3px]"
          role="radiogroup"
          aria-label="Workout day"
        >
          <button
            v-for="d in dayOptions"
            :key="d.type"
            type="button"
            role="radio"
            :aria-checked="dayType === d.type"
            class="flex h-[34px] min-w-[72px] flex-1 items-center justify-center whitespace-nowrap rounded-[6px] px-2 text-sm"
            :class="dayType === d.type ? 'bg-accent-800 font-medium text-accent-200' : 'text-neutral-400'"
            @click="store.setDayType(form.date, d.type)"
          >
            {{ d.name }}
          </button>
        </div>
      </div>

      <!-- Day progress -->
      <div class="flex flex-col gap-2">
        <div class="grid gap-1" :style="{ gridTemplateColumns: `repeat(${planSlots.length}, 1fr)` }">
          <span
            v-for="(s, i) in slotState"
            :key="i"
            class="h-1.5 rounded-[3px]"
            :class="[segment(s), allDone && 'shadow-[0_0_10px_theme(colors.accent.600)]']"
          />
        </div>
        <div v-if="!allDone" class="flex justify-between text-[13px] text-neutral-400">
          <span>
            <span class="font-medium text-accent-300">{{ doneSlots }} done</span> · {{ leftSlots }} left<template v-if="skippedCount"> · {{ skippedCount }} skipped</template>
          </span>
          <span>{{ currentSlot >= 0 ? `${currentSlot + 1} of ${planSlots.length}` : 'Extra' }}</span>
        </div>
      </div>

      <!-- ========== All done ========== -->
      <template v-if="allDone">
        <div class="flex flex-col gap-3 pb-2 pt-7">
          <span class="flex size-[72px] items-center justify-center rounded-full text-4xl text-accent-300 shadow-[inset_0_0_0_2px_theme(colors.accent.DEFAULT),0_0_40px_-4px_theme(colors.accent.600)]">
            <i class="ph-bold ph-check" />
          </span>
          <h1 class="text-[34px] font-medium leading-[1.1] tracking-[-0.02em]">All done for this day ✓</h1>
          <span class="text-base leading-[1.45] text-neutral-300">{{ dayStats.exercises }} exercises · {{ dayStats.sets }} sets</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="card flex flex-col gap-1 p-3.5">
            <span class="tnum text-[32px] font-medium text-accent-300">{{ dayStats.heavier }}</span>
            <span class="label">heavier than last time</span>
          </div>
          <div class="card flex flex-col gap-1 p-3.5">
            <span class="tnum text-[32px] font-medium">{{ dayStats.matched }}</span>
            <span class="label">matched last time</span>
          </div>
          <div v-if="dayStats.lighter" class="card flex flex-col gap-1 p-3.5">
            <span class="tnum text-[32px] font-medium text-neutral-300">{{ dayStats.lighter }}</span>
            <span class="label">lighter than last time</span>
          </div>
        </div>
      </template>

      <!-- ========== Logging ========== -->
      <template v-else>
        <!-- Exercise + last time -->
        <div class="card flex flex-col gap-4 p-[18px]">
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 flex-col gap-1">
              <span class="text-xs font-medium uppercase tracking-[0.06em] text-accent-400">{{ kicker }}</span>
              <span class="text-[26px] font-medium leading-[1.15] tracking-[-0.01em]">{{ name }}</span>
            </div>
            <button
              v-if="editing"
              type="button"
              aria-label="Cancel editing"
              class="flex size-11 flex-none items-center justify-center rounded-md text-xl text-neutral-300 shadow-sm active:bg-neutral-900"
              @click="stopEdit"
            >
              <i class="ph ph-x" />
            </button>
            <button
              v-else
              type="button"
              aria-label="Change exercise"
              class="flex size-11 flex-none items-center justify-center rounded-md text-xl text-neutral-300 shadow-sm active:bg-neutral-900"
              @click="picking = true"
            >
              <i class="ph ph-arrows-down-up" />
            </button>
          </div>

          <div v-if="last" class="flex items-end justify-between gap-3 pt-3.5 shadow-[0_-1px_0_theme(colors.neutral.800)]">
            <div class="flex flex-col gap-1">
              <span class="label">Last time · {{ lastWhen }}</span>
              <span class="tnum text-[22px] font-medium">
                {{ last.weight }} {{ last.unit }}<span v-if="last.perDumbbell" class="text-[15px] font-normal text-neutral-400"> each</span>
                <span class="text-[15px] font-normal text-neutral-400"> ≈ {{ convertedFull(last) }}</span>
              </span>
              <span v-if="last.sets && last.reps" class="tnum text-sm text-neutral-300">{{ last.sets }} × {{ last.reps }}</span>
              <span v-else class="text-sm text-neutral-400">Baseline, no sets/reps</span>
            </div>
            <button type="button" class="btn-outline h-11 flex-none px-3.5 text-sm" @click="useLast">
              <i class="ph ph-arrow-u-down-left" />Continue
            </button>
          </div>
          <div v-else class="flex items-center gap-2.5 rounded-md p-3 text-sm leading-[1.4] text-neutral-300 shadow-[inset_0_0_0_1px_theme(colors.neutral.800)]">
            <i class="ph ph-sparkle text-xl text-accent-400" />No previous log. Today's weight becomes the one to beat.
          </div>

          <!-- Machine max (target) -->
          <div v-if="maxForm.open" class="flex flex-col gap-2.5 pt-3.5 shadow-[0_-1px_0_theme(colors.neutral.800)]">
            <span class="label">Machine max · heaviest the stack goes</span>
            <div class="flex items-center gap-2">
              <label class="tnum flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-base focus-within:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]">
                <input
                  v-model.number="maxForm.weight"
                  type="number"
                  step="any"
                  inputmode="decimal"
                  aria-label="Machine max weight"
                  placeholder="0"
                  class="w-full min-w-0 bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  @keydown.enter.prevent="saveMax()"
                />
              </label>
              <div class="flex rounded-md bg-neutral-900 p-[3px]" role="radiogroup" aria-label="Machine max unit">
                <button
                  v-for="u in (['lbs', 'kg'] as Unit[])"
                  :key="u"
                  type="button"
                  role="radio"
                  :aria-checked="maxForm.unit === u"
                  class="flex h-[38px] w-[46px] items-center justify-center rounded-[6px] text-sm"
                  :class="maxForm.unit === u ? 'bg-accent-800 font-medium text-accent-200' : 'text-neutral-400'"
                  @click="maxForm.unit = u"
                >
                  {{ u }}
                </button>
              </div>
            </div>
            <div class="flex gap-2">
              <button type="button" class="btn-outline h-11 flex-1 text-sm disabled:opacity-40" :disabled="!maxForm.weight" @click="saveMax()">
                <i class="ph ph-check" />Save max
              </button>
              <button v-if="max" type="button" class="btn-outline h-11 px-3.5 text-sm" @click="saveMax(undefined)">
                <i class="ph ph-trash" />Clear
              </button>
              <button type="button" class="h-11 px-3.5 text-sm text-neutral-400" @click="maxForm.open = false">Cancel</button>
            </div>
          </div>
          <button
            v-else-if="max"
            type="button"
            class="flex flex-col gap-2 pt-3.5 text-left shadow-[0_-1px_0_theme(colors.neutral.800)]"
            @click="editMax"
          >
            <span class="flex w-full items-center justify-between gap-3">
              <span class="label">Machine max · target</span>
              <span class="tnum text-sm">
                {{ max.weight }} {{ max.unit }}<span class="text-neutral-400"> ≈ {{ convertedFull(max) }}</span>
                <i class="ph ph-pencil-simple ml-1 text-neutral-500" />
              </span>
            </span>
            <span v-if="last" class="h-1.5 w-full overflow-hidden rounded-[3px] bg-neutral-900">
              <span class="block h-full rounded-[3px]" :class="lastPct >= 100 ? 'bg-accent-300' : 'bg-accent'" :style="{ width: `${lastPct}%` }" />
            </span>
            <span v-if="last" class="tnum text-[13px] text-neutral-400">
              Last time {{ fixed1(kgOf(last)) }} of {{ fixed1(maxKg) }} kg · {{ lastPct }}%<template v-if="atMaxCount"> · at max {{ atMaxCount }}×</template>
            </span>
          </button>
          <button
            v-else
            type="button"
            class="flex min-h-11 items-center gap-2 pt-3.5 text-sm text-neutral-400 shadow-[0_-1px_0_theme(colors.neutral.800)]"
            @click="editMax"
          >
            <i class="ph ph-plus" />Set machine max
          </button>

          <p
            v-if="atMaxCount >= MAX_SESSIONS_TO_SWITCH && !maxForm.open"
            class="flex gap-2.5 rounded-md bg-warn-tint p-3 text-[13px] leading-[1.45] text-warn-text"
          >
            <i class="ph ph-warning flex-none text-lg" />
            You've hit this machine's max on {{ atMaxCount }} sessions. To keep progressive overload going, switch to a harder exercise
            (free weights, single-arm or single-leg) or add reps and slow the tempo.
          </p>
        </div>

        <!-- Weight -->
        <div class="flex flex-col gap-2.5">
          <div class="flex items-center justify-between">
            <span class="label">Weight</span>
            <div class="flex rounded-md bg-neutral-900 p-[3px]" role="radiogroup" aria-label="Unit">
              <button
                v-for="u in (['lbs', 'kg'] as Unit[])"
                :key="u"
                type="button"
                role="radio"
                :aria-checked="form.unit === u"
                class="flex h-[34px] w-[52px] items-center justify-center rounded-[6px] text-sm"
                :class="form.unit === u ? 'bg-accent-800 font-medium text-accent-200' : 'text-neutral-400'"
                @click="form.unit = u"
              >
                {{ u }}
              </button>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Decrease weight"
              class="card flex size-16 flex-none items-center justify-center text-[26px] active:bg-neutral-900"
              :class="!form.weight && !placeholder && 'text-neutral-600'"
              @click="nudge(-1)"
            >
              <i class="ph ph-minus" />
            </button>
            <div class="flex min-w-0 flex-col items-center">
              <label class="tnum flex items-baseline text-[68px] font-medium leading-none tracking-[-0.03em]">
                <input
                  v-model.number="form.weight"
                  type="number"
                  step="any"
                  inputmode="decimal"
                  aria-label="Weight"
                  :placeholder="String(placeholder)"
                  class="bg-transparent text-center placeholder:text-neutral-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  :style="{ width: `${weightChars * 0.62 + 0.1}em` }"
                />
                <span class="ml-1 text-xl font-normal tracking-normal" :class="form.weight ? 'text-neutral-400' : 'text-neutral-700'">{{ form.unit }}</span>
              </label>
              <span class="tnum mt-1.5 text-sm" :class="form.weight ? 'text-neutral-400' : 'text-neutral-500'">
                <template v-if="form.weight">
                  {{ preview }}<template v-if="vsLast"> · <span :class="vsLast.up && 'text-accent-300'">{{ vsLast.text }}</span></template><template v-if="atMaxNow"> · <span class="text-accent-300">machine max</span></template>
                </template>
                <template v-else>Tap the number to type</template>
              </span>
            </div>
            <button
              type="button"
              aria-label="Increase weight"
              class="card flex size-16 flex-none items-center justify-center text-[26px] active:bg-neutral-900"
              @click="nudge(1)"
            >
              <i class="ph ph-plus" />
            </button>
          </div>
        </div>

        <!-- Sets / reps -->
        <div class="grid grid-cols-2 gap-3">
          <MiniStepper v-model="form.sets" label="Sets" />
          <MiniStepper v-model="form.reps" label="Reps" />
        </div>

        <!-- Per dumbbell -->
        <label class="flex min-h-12 cursor-pointer items-center justify-between">
          <span class="text-[15px]">Weight is per dumbbell</span>
          <input v-model="form.perDumbbell" type="checkbox" class="peer sr-only" />
          <span
            class="relative h-8 w-[52px] rounded-2xl transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
            :class="form.perDumbbell ? 'bg-accent-700' : 'bg-neutral-800'"
          >
            <span
              class="absolute left-[3px] top-[3px] size-[26px] rounded-[13px] transition-transform"
              :class="form.perDumbbell ? 'translate-x-5 bg-accent-200' : 'bg-neutral-400'"
            />
          </span>
        </label>
        <button
          v-if="editing"
          type="button"
          class="flex h-12 items-center justify-center gap-2 rounded-lg text-[15px] text-neutral-300 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)] active:bg-neutral-900"
          @click="removeEditing"
        >
          <i class="ph ph-trash" />Delete this entry
        </button>
      </template>

      <!-- Done on this date -->
      <div v-if="chips.length" class="flex flex-col gap-2.5">
        <span class="label">Done on this date · tap to edit</span>
        <ul class="flex flex-wrap gap-1.5">
          <li v-for="c in chips" :key="c.name">
            <span v-if="c.skipped" class="chip text-neutral-400 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)]">skipped · {{ short(c.name) }}</span>
            <button
              v-else
              type="button"
              class="chip bg-accent-900 text-accent-200 active:bg-accent-800"
              :class="editing?.exercise === c.name && 'shadow-[inset_0_0_0_1.5px_theme(colors.accent.DEFAULT)]'"
              @click="startEdit(c.name)"
            >
              <i class="ph-bold ph-check" />{{ short(c.name) }}
            </button>
          </li>
        </ul>
      </div>

      <button
        v-if="allDone"
        type="button"
        class="flex h-[52px] items-center justify-center gap-2 rounded-lg text-[15px] text-neutral-200 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)] active:bg-neutral-900"
        @click="picking = true"
      >
        <i class="ph ph-plus" />Log an extra exercise
      </button>

      <!-- Saved toast + sticky Save, in the thumb zone above the tab bar -->
      <template v-if="!allDone">
        <Transition
          enter-from-class="translate-y-2 opacity-0"
          leave-to-class="opacity-0"
          enter-active-class="transition duration-200"
          leave-active-class="transition duration-300"
        >
          <div
            v-if="saved"
            role="status"
            class="fixed inset-x-5 z-20 mx-auto flex h-11 max-w-[calc(42rem-40px)] items-center gap-2 rounded-md bg-neutral-900 px-3.5 text-sm shadow-md"
            style="bottom: calc(var(--tabbar) + 88px)"
          >
            <i class="ph-fill ph-check-circle text-lg text-accent-400" />{{ saved }}
          </div>
        </Transition>
        <div class="fixed inset-x-0 z-20 bg-bg" style="bottom: var(--tabbar)">
          <div class="mx-auto max-w-2xl px-5 py-3">
            <button
              :disabled="!form.weight"
              class="flex h-14 w-full items-center justify-center gap-2 rounded-lg text-[17px] font-medium"
              :class="
                form.weight
                  ? 'bg-accent-900 text-accent-100 shadow-[inset_0_0_0_1.5px_theme(colors.accent.DEFAULT),0_0_24px_-6px_theme(colors.accent.600)] active:bg-accent-800'
                  : 'text-neutral-500 shadow-[inset_0_0_0_1.5px_theme(colors.neutral.700)]'
              "
            >
              <i class="ph-bold ph-check" />
              <span class="truncate">{{ form.weight ? `${editing ? 'Update' : 'Save'} ${short(name)}` : 'Enter a weight to save' }}</span>
            </button>
          </div>
        </div>
      </template>
    </form>

    <ExercisePicker
      v-if="picking"
      :rows="pickerRows"
      :selected="name"
      :done-count="doneSlots"
      :left-count="leftSlots"
      :last-of="(n: string) => store.byExercise(n)[0]"
      @close="picking = false"
      @select="pick"
    />
  </div>
</template>
