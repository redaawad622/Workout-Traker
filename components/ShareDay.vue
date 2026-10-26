<script setup lang="ts">
import { todayISO, fmtDay, convertedShort, daysBetween } from '~/utils/format'
import { SLOTS, NUTRIENTS, fmtN, plural } from '~/utils/nutrition'
import { volumeKg, grouped, windowStart } from '~/utils/reports'
import { mealTotals, useDietStore } from '~/stores/diet'

// Sends the workouts and meals of one day, or of a range of days, to any AI app as text, with an optional question.
const store = useWorkoutStore()
const diet = useDietStore()
const ai = useAi()

const from = ref(todayISO())
const to = ref(todayISO())
const question = ref('')
const status = ref('')

// Picking a From after To (or a To before From) moves the other end along.
watch(from, (f) => f > to.value && (to.value = f))
watch(to, (t) => t < from.value && (from.value = t))

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' }
]
const pickedRange = computed(() => (to.value === todayISO() ? RANGES.find((r) => windowStart(to.value, r.days) === from.value)?.days : undefined))
function pick(days: number) {
  to.value = todayISO()
  from.value = windowStart(to.value, days)
}

const dayCount = computed(() => daysBetween(from.value, to.value) + 1)

// Every date from..to, oldest first.
function datesIn(f: string, t: string) {
  const out: string[] = []
  for (let n = daysBetween(f, t); n >= 0; n--) out.push(windowStart(t, n + 1))
  return out
}

const amount = (m: { grams: number; servings?: number; servingLabel?: string }) =>
  m.servings != null ? `${m.servings} ${plural(m.servingLabel ?? 'serving', m.servings)} (${Math.round(m.grams)} g)` : `${Math.round(m.grams)} g`

const liftsOn = (d: string) => store.verified.filter((e) => e.date === d).sort((a, b) => (a.id ?? 0) - (b.id ?? 0))

// One day's workouts and meals. `single` keeps the empty-section notes and the latest body weight fallback.
function dayLines(d: string, single: boolean) {
  const lines: string[] = []
  const lifts = liftsOn(d)
  const bw = lifts.find((e) => e.bodyWeightKg)?.bodyWeightKg ?? (single ? store.latestBodyWeight : undefined)
  if (bw) lines.push(`Body weight: ${bw} kg`)

  if (single || lifts.length) lines.push('', 'WORKOUT')
  if (!lifts.length) {
    if (single) lines.push('No exercises logged.')
  } else {
    const type = store.dayTypes[d]
    if (type) lines.push(`Day: ${store.dayLabel(type)}`)
    for (const e of lifts) {
      const prev = store.byExercise(e.exercise).find((p) => p.date < d)
      const max = store.machineMax?.[e.exercise]
      lines.push(
        `- ${e.exercise}: ${e.weight} ${e.unit}${e.perDumbbell ? ' per dumbbell' : ''} (${convertedShort(e)}${e.unit === 'lbs' ? ' kg' : ''})` +
          (e.sets && e.reps ? `, ${e.sets} × ${e.reps}` : '') +
          (prev ? `; last time ${prev.weight} ${prev.unit}${prev.sets && prev.reps ? ` ${prev.sets} × ${prev.reps}` : ''} on ${prev.date}` : '; first time') +
          (max ? `; machine max ${max.weight} ${max.unit}` : '')
      )
    }
    const kg = lifts.reduce((n, e) => n + volumeKg(e), 0)
    const sets = lifts.reduce((n, e) => n + (e.reps ? e.sets ?? 0 : 0), 0)
    lines.push(`Total: ${grouped(kg)} kg lifted (weight × reps × sets), ${sets} sets`)
  }

  const meals = diet.byDate(d)
  if (single || meals.length) lines.push('', 'FOOD')
  if (single && !meals.length) lines.push('No meals logged.')
  for (const s of SLOTS) {
    const list = meals.filter((m) => m.slot === s.key)
    if (!list.length) continue
    lines.push(`${s.label}:`)
    for (const m of list) {
      const t = mealTotals(m)
      lines.push(`- ${m.name}, ${amount(m)}: ${Math.round(t.kcal)} kcal, P ${fmtN(t.protein, 'protein')} g, C ${fmtN(t.carbs, 'carbs')} g, F ${fmtN(t.fat, 'fat')} g`)
    }
  }
  if (meals.length) {
    const total = diet.totalsFor(d)
    const goals = diet.goals as Record<string, number> | null
    lines.push(
      'Totals: ' +
        NUTRIENTS.map((n) => `${n.label} ${fmtN(total[n.key], n.key)} ${n.unit}${goals?.[n.key] ? ` (goal ${goals[n.key]})` : ''}`).join(', ')
    )
  }

  return lines
}

function buildReport(f: string, t: string) {
  const ask = ['', question.value.trim() || "I'll ask my question next."]
  if (f === t) return [`My Workout Tracker log for ${fmtDay(f)}, ${f.slice(0, 4)}.`, ...dayLines(f, true), ...ask].join('\n')

  const dates = datesIn(f, t)
  const logged = dates.filter((d) => liftsOn(d).length || diet.byDate(d).length)
  const lines = [`My Workout Tracker log from ${fmtDay(f)}, ${f.slice(0, 4)} to ${fmtDay(t)}, ${t.slice(0, 4)} (${dates.length} days).`]
  const goals = diet.goals as Record<string, number> | null
  const goalText = goals && NUTRIENTS.filter((n) => goals[n.key]).map((n) => `${n.label} ${goals[n.key]} ${n.unit}`).join(', ')
  if (goalText) lines.push(`Daily goals: ${goalText}`)
  if (store.latestBodyWeight) lines.push(`Latest body weight: ${store.latestBodyWeight} kg`)

  for (const d of logged) lines.push('', `=== ${fmtDay(d)}, ${d.slice(0, 4)} ===`, ...dayLines(d, false))

  const empty = dates.filter((d) => !logged.includes(d))
  if (empty.length) lines.push('', `Nothing logged on: ${empty.map((d) => fmtDay(d)).join(', ')}`)

  const lifts = dates.flatMap(liftsOn)
  const workoutDays = dates.filter((d) => liftsOn(d).length).length
  const foodDays = dates.filter((d) => diet.byDate(d).length)
  lines.push('', 'RANGE SUMMARY', `Workout days: ${workoutDays} of ${dates.length}`)
  if (lifts.length) lines.push(`Total lifted: ${grouped(lifts.reduce((n, e) => n + volumeKg(e), 0))} kg (weight × reps × sets)`)
  if (foodDays.length) {
    const avg = (key: string) => foodDays.reduce((n, d) => n + (diet.totalsFor(d) as Record<string, number>)[key], 0) / foodDays.length
    lines.push(
      `Daily average over the ${foodDays.length} ${plural('day', foodDays.length)} with meals logged: ` +
        NUTRIENTS.map((n) => `${n.label} ${fmtN(avg(n.key), n.key)} ${n.unit}`).join(', ')
    )
  }
  return [...lines, ...ask].join('\n')
}

async function share() {
  const how = await ai.share(buildReport(from.value, to.value))
  status.value = how === 'shared' ? '' : 'Report copied. Paste it in your AI app and ask away.'
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <span class="label">Ask AI about your days</span>
    <div class="card flex flex-col gap-3 p-3.5">
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="r in RANGES"
          :key="r.days"
          type="button"
          :aria-pressed="pickedRange === r.days"
          class="h-9 rounded-md text-sm"
          :class="pickedRange === r.days ? 'font-medium text-accent-300 shadow-[inset_0_0_0_1px_theme(colors.accent.DEFAULT)]' : 'text-neutral-300 shadow-sm active:bg-neutral-900'"
          @click="pick(r.days)"
        >
          {{ r.label }}
        </button>
      </div>
      <label class="flex items-center justify-between gap-3 text-[15px]">
        From
        <input v-model="from" type="date" :max="todayISO()" class="h-10 rounded-md bg-bg px-3 text-sm shadow-sm" />
      </label>
      <label class="flex items-center justify-between gap-3 text-[15px]">
        To
        <input v-model="to" type="date" :max="todayISO()" class="h-10 rounded-md bg-bg px-3 text-sm shadow-sm" />
      </label>
      <textarea
        v-model="question"
        rows="2"
        placeholder="Your question (optional), e.g. How was my protein? What should I eat tonight?"
        aria-label="Question for the AI"
        class="rounded-md bg-bg px-3 py-2 text-sm shadow-sm placeholder:text-neutral-600 focus:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]"
      />
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-md text-[15px] text-accent-300 shadow-[inset_0_0_0_1px_theme(colors.accent.DEFAULT)] active:bg-accent-900"
        @click="share"
      >
        <i class="ph ph-sparkle" />{{ dayCount === 1 ? 'Share day with AI' : `Share ${dayCount} days with AI` }}
      </button>
      <span v-if="status" role="status" class="text-xs text-neutral-400">{{ status }}</span>
      <span class="text-xs leading-[1.45] text-neutral-500">Sends the workouts and meals of those days as text to the AI app you pick. Nothing is sent anywhere else.</span>
    </div>
  </section>
</template>
