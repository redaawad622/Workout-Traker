<script setup lang="ts">
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip } from 'chart.js'
import { toKg } from '~/utils/units'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip)

const store = useWorkoutStore()
const selected = ref(store.exercises.includes('Lat Pulldown') ? 'Lat Pulldown' : store.exercises[0])

const rows = computed(() => [...store.byExercise(selected.value)].reverse())

const chartData = computed(() => ({
  labels: rows.value.map((r) => r.date),
  datasets: [
    {
      label: 'kg',
      data: rows.value.map((r) => toKg(r.weight, r.unit)),
      borderColor: '#34d399',
      backgroundColor: '#34d399',
      tension: 0.25
    }
  ]
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
    y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
  }
}
</script>

<template>
  <div>
    <h1 class="mb-4 text-2xl font-bold">Progress</h1>
    <select v-model="selected" class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
      <option v-for="e in store.exercises" :key="e">{{ e }}</option>
    </select>

    <div v-if="rows.length > 1" class="h-64 rounded-xl bg-slate-900 p-3">
      <Line :data="chartData" :options="options" />
    </div>
    <p v-else class="rounded-xl bg-slate-900 p-4 text-slate-400">Log this exercise at least twice to see a trend.</p>

    <ul class="mt-4 divide-y divide-slate-800 rounded-xl bg-slate-900">
      <li v-for="r in [...rows].reverse()" :key="r.id" class="flex justify-between p-3 text-sm">
        <span>{{ r.date }}</span>
        <span>{{ r.weight }} {{ r.unit }} · {{ toKg(r.weight, r.unit) }} kg<template v-if="r.sets && r.reps"> · {{ r.sets }}×{{ r.reps }}</template></span>
      </li>
    </ul>
  </div>
</template>
