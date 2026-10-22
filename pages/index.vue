<script setup lang="ts">
import { toKg, toLbs } from '~/utils/units'
const store = useWorkoutStore()

const original = (e: { weight: number; unit: 'lbs' | 'kg' }) => `${e.weight} ${e.unit}`
const kgText = (e: { weight: number; unit: 'lbs' | 'kg'; perDumbbell?: boolean }) =>
  `${toKg(e.weight, e.unit)} kg${e.perDumbbell ? ' / dumbbell' : ''}`
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

const th = 'py-2 text-left text-sm font-semibold text-slate-300'
const td = 'py-3 pr-2 align-top'
</script>

<template>
  <div class="space-y-8">
    <!-- Latest sessions -->
    <section v-for="s in store.sessions" :key="s.date">
      <div class="mb-2 flex items-end justify-between">
        <h2 class="text-lg font-bold">{{ fmtDate(s.date) }}</h2>
        <span v-if="s.bodyWeightKg" class="text-sm text-slate-400">Body: {{ s.bodyWeightKg }} kg</span>
      </div>
      <ul class="space-y-2">
        <li v-for="e in s.items" :key="e.id" class="rounded-xl bg-slate-900 p-4">
          <p class="font-medium">{{ e.exercise }}</p>
          <p class="mt-1 text-emerald-400">{{ e.weight }} {{ e.unit }} ≈ {{ e.unit === 'lbs' ? toKg(e.weight, e.unit) + ' kg' : toLbs(e.weight, e.unit) + ' lbs' }}</p>
          <p v-if="e.sets && e.reps" class="text-sm text-slate-400">{{ e.reps }} reps × {{ e.sets }} sets</p>
        </li>
      </ul>
    </section>

    <h1 class="text-2xl font-bold">Full historical record</h1>

    <!-- Initial assessment -->
    <section>
      <h2 class="mb-2 text-lg font-bold">Initial assessment — {{ store.assessment[0] ? fmtDate(store.assessment[0].date) : '' }}</h2>
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b border-slate-700">
            <th :class="th" class="w-8">#</th>
            <th :class="th">Exercise</th>
            <th :class="th">Original weight</th>
            <th :class="th">In kg</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in store.assessment" :key="e.id" class="border-b border-slate-800">
            <td :class="td">{{ i + 1 }}</td>
            <td :class="td">{{ e.exercise }}</td>
            <td :class="td">{{ original(e) }}</td>
            <td :class="td">{{ kgText(e) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Later updates -->
    <section v-if="store.unverified.length">
      <h2 class="mb-1 text-lg font-bold">Later updates mentioned in the log</h2>
      <p class="mb-2 text-sm text-amber-300/80">No confirmed date. Excluded from the sections above until you confirm them.</p>
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b border-slate-700">
            <th :class="th">Exercise</th>
            <th :class="th">Logged weight</th>
            <th :class="th">In kg</th>
            <th :class="th"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in store.unverified" :key="e.id" class="border-b border-slate-800">
            <td :class="td">{{ e.exercise }}</td>
            <td :class="td">{{ original(e) }}</td>
            <td :class="td">{{ kgText(e) }}</td>
            <td :class="td" class="whitespace-nowrap text-right">
              <button class="mr-1 rounded bg-emerald-700 px-2 py-1 text-xs" @click="store.confirm(e.id!, e.date)">Confirm</button>
              <button class="rounded bg-slate-700 px-2 py-1 text-xs" @click="store.remove(e.id!)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
