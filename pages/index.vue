<script setup lang="ts">
import { toKg, toLbs } from '~/utils/units'
const store = useWorkoutStore()

const fmt = (w: number, u: 'lbs' | 'kg') =>
  u === 'lbs' ? `${w} lbs · ${toKg(w, u)} kg` : `${w} kg · ${toLbs(w, u)} lbs`
</script>

<template>
  <div>
    <header class="mb-5 flex items-end justify-between">
      <h1 class="text-2xl font-bold">Where I stand</h1>
      <span v-if="store.latestBodyWeight" class="text-sm text-slate-400">
        Body: {{ store.latestBodyWeight }} kg
      </span>
    </header>

    <ul class="space-y-3">
      <li v-for="s in store.summary" :key="s.exercise" class="rounded-xl bg-slate-900 p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-medium">{{ s.exercise }}</p>
            <p class="mt-1 text-lg text-emerald-400">
              {{ fmt(s.latest.weight, s.latest.unit) }}
              <span v-if="s.latest.perDumbbell" class="text-xs text-slate-400">each</span>
            </p>
            <p class="text-xs text-slate-500">
              {{ s.latest.date }}<template v-if="s.latest.sets && s.latest.reps"> · {{ s.latest.sets }} × {{ s.latest.reps }}</template>
            </p>
          </div>
          <span
            v-if="s.deltaKg !== undefined"
            class="rounded-full px-2 py-1 text-xs"
            :class="s.deltaKg > 0 ? 'bg-emerald-900 text-emerald-300' : s.deltaKg < 0 ? 'bg-rose-900 text-rose-300' : 'bg-slate-800 text-slate-400'"
          >
            {{ s.deltaKg > 0 ? '+' : '' }}{{ s.deltaKg }} kg
          </span>
        </div>
      </li>
    </ul>

    <section v-if="store.unverified.length" class="mt-8 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
      <h2 class="font-semibold text-amber-300">Unverified entries ({{ store.unverified.length }})</h2>
      <p class="mt-1 text-sm text-amber-200/70">
        These came from an earlier update with no confirmed date. They are excluded from the numbers above.
      </p>
      <ul class="mt-3 space-y-2 text-sm">
        <li v-for="e in store.unverified" :key="e.id" class="flex items-center justify-between gap-2">
          <span>{{ e.exercise }} — {{ fmt(e.weight, e.unit) }}</span>
          <span class="flex gap-2">
            <button class="rounded bg-emerald-700 px-2 py-1" @click="store.confirm(e.id!, e.date)">Confirm</button>
            <button class="rounded bg-slate-700 px-2 py-1" @click="store.remove(e.id!)">Delete</button>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
