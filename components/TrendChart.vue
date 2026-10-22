<script setup lang="ts">
import { fmtShort } from '~/utils/format'

// Weight (kg) over time. Points are evenly spaced; the newest one gets a halo.
const props = defineProps<{ points: { date: string; kg: number; baseline: boolean }[] }>()

const X0 = 36, X1 = 340, TOP = 20, ROW = 35, FLOOR = 160

const scale = computed(() => {
  const kgs = props.points.map((p) => p.kg)
  const lo = Math.min(...kgs), hi = Math.max(...kgs)
  // Four gridlines; pick the smallest round step that keeps every point inside them.
  for (const step of [1, 2, 5, 10, 20, 50]) {
    const top = Math.ceil(hi / step) * step
    if (top - 3 * step <= lo) return { step, top }
  }
  return { step: 100, top: Math.ceil(hi / 100) * 100 }
})

const ticks = computed(() => [0, 1, 2, 3].map((i) => ({ y: TOP + i * ROW, v: scale.value.top - i * scale.value.step })))

const xy = computed(() =>
  props.points.map((p, i) => ({
    ...p,
    x: props.points.length === 1 ? X1 : X0 + ((X1 - X0) * i) / (props.points.length - 1),
    y: TOP + ((scale.value.top - p.kg) / scale.value.step) * ROW
  }))
)
const line = computed(() => xy.value.map((p) => `${p.x},${p.y.toFixed(1)}`).join(' '))
const area = computed(() => `${line.value} ${X1},${FLOOR} ${X0},${FLOOR}`)
const last = computed(() => xy.value[xy.value.length - 1])
const mid = computed(() => (xy.value.length > 2 ? xy.value[Math.floor((xy.value.length - 1) / 2)] : null))
</script>

<template>
  <div class="card px-2 pb-2 pt-3.5">
    <svg viewBox="0 0 350 190" width="100%" class="block font-sans" role="img" aria-label="Weight trend in kg">
      <g v-for="t in ticks" :key="t.y">
        <line x1="30" x2="344" :y1="t.y" :y2="t.y" class="stroke-neutral-800" stroke-width="1" />
        <text x="0" :y="t.y + 4" font-size="11" class="fill-neutral-500">{{ t.v }}</text>
      </g>
      <polygon :points="area" class="fill-accent-900" opacity="0.8" />
      <polyline :points="line" fill="none" class="stroke-accent" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      <template v-for="(p, i) in xy" :key="i">
        <circle v-if="p.baseline" :cx="p.x" :cy="p.y" r="4" class="fill-surface stroke-neutral-400" stroke-width="1.5" />
        <circle v-else-if="i < xy.length - 1" :cx="p.x" :cy="p.y" r="3.5" class="fill-accent" />
      </template>
      <circle :cx="last.x" :cy="last.y" r="9" class="fill-accent" opacity="0.25" />
      <circle :cx="last.x" :cy="last.y" r="5" class="fill-accent-300" />
      <text :x="X0" y="182" font-size="11" class="fill-neutral-500" text-anchor="start">{{ fmtShort(xy[0].date) }}</text>
      <text v-if="mid" :x="mid.x" y="182" font-size="11" class="fill-neutral-500" text-anchor="middle">{{ fmtShort(mid.date) }}</text>
      <text x="344" y="182" font-size="11" class="fill-neutral-500" text-anchor="end">{{ fmtShort(last.date) }}</text>
    </svg>
  </div>
</template>
