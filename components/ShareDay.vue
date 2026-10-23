<script setup lang="ts">
import { todayISO, fmtDay, convertedShort } from '~/utils/format'
import { SLOTS, NUTRIENTS, fmtN, plural } from '~/utils/nutrition'
import { volumeKg, grouped } from '~/utils/reports'
import { mealTotals, useDietStore } from '~/stores/diet'

// Sends one day's workouts and meals to any AI app as text, with an optional question.
const store = useWorkoutStore()
const diet = useDietStore()
const ai = useAi()

const date = ref(todayISO())
const question = ref('')
const status = ref('')

const amount = (m: { grams: number; servings?: number; servingLabel?: string }) =>
  m.servings != null ? `${m.servings} ${plural(m.servingLabel ?? 'serving', m.servings)} (${Math.round(m.grams)} g)` : `${Math.round(m.grams)} g`

function buildReport(d: string) {
  const lines = [`My Workout Tracker log for ${fmtDay(d)}, ${d.slice(0, 4)}.`]
  const lifts = store.verified.filter((e) => e.date === d).sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  const bw = lifts.find((e) => e.bodyWeightKg)?.bodyWeightKg ?? store.latestBodyWeight
  if (bw) lines.push(`Body weight: ${bw} kg`)

  lines.push('', 'WORKOUT')
  if (!lifts.length) lines.push('No exercises logged.')
  else {
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

  lines.push('', 'FOOD')
  const meals = diet.byDate(d)
  if (!meals.length) lines.push('No meals logged.')
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

  lines.push('', question.value.trim() || "I'll ask my question next.")
  return lines.join('\n')
}

async function share() {
  const how = await ai.share(buildReport(date.value))
  status.value = how === 'shared' ? '' : 'Report copied. Paste it in your AI app and ask away.'
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <span class="label">Ask AI about a day</span>
    <div class="card flex flex-col gap-3 p-3.5">
      <label class="flex items-center justify-between gap-3 text-[15px]">
        Day
        <input v-model="date" type="date" :max="todayISO()" class="h-10 rounded-md bg-bg px-3 text-sm shadow-sm" />
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
        <i class="ph ph-sparkle" />Share day with AI
      </button>
      <span v-if="status" role="status" class="text-xs text-neutral-400">{{ status }}</span>
      <span class="text-xs leading-[1.45] text-neutral-500">Sends that day's workouts and meals as text to the AI app you pick. Nothing is sent anywhere else.</span>
    </div>
  </section>
</template>
