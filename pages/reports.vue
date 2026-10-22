<script setup lang="ts">
import { todayISO } from '~/utils/format'
import { grouped, PERIODS, report } from '~/utils/reports'
import { useDietStore } from '~/stores/diet'

const store = useWorkoutStore()
const diet = useDietStore()

const rows = computed(() => {
  const today = todayISO()
  return PERIODS.map((p) => ({ ...p, r: report(store.entries, diet.meals, today, p.days) }))
})

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-[28px] font-medium tracking-[-0.01em]">Reports</h1>
      <NuxtLink to="/data" class="flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-neutral-300 shadow-sm active:bg-neutral-900">
        <i class="ph ph-database" />Backup
      </NuxtLink>
    </div>

    <section v-for="p in rows" :key="p.key" class="flex flex-col gap-2">
      <span class="label">{{ p.label }}</span>
      <div class="card tnum grid grid-cols-2">
        <div class="flex flex-col gap-1 p-3.5 shadow-[1px_0_0_theme(colors.neutral.800)]">
          <span class="flex items-center gap-1.5 text-[13px] text-neutral-400"><i class="ph ph-fork-knife" />Calories eaten</span>
          <span class="text-[26px] font-medium leading-tight tracking-[-0.02em]">
            {{ grouped(p.r.kcal) }}<span class="ml-1 text-sm font-normal tracking-normal text-neutral-400">kcal</span>
          </span>
          <span class="text-xs text-neutral-400">
            <template v-if="!p.r.kcalDays">No meals logged</template>
            <template v-else-if="p.key === 'today'">{{ plural(diet.byDate(todayISO()).length, 'food') }}</template>
            <template v-else>≈ {{ grouped(p.r.kcal / p.r.kcalDays) }}/day · {{ plural(p.r.kcalDays, 'day') }}</template>
          </span>
        </div>
        <div class="flex flex-col gap-1 p-3.5">
          <span class="flex items-center gap-1.5 text-[13px] text-neutral-400"><i class="ph ph-barbell" />Weight lifted</span>
          <span class="text-[26px] font-medium leading-tight tracking-[-0.02em]">
            {{ grouped(p.r.liftedKg) }}<span class="ml-1 text-sm font-normal tracking-normal text-neutral-400">kg</span>
          </span>
          <span class="text-xs text-neutral-400">
            <template v-if="!p.r.sessions">No sets logged</template>
            <template v-else-if="p.key === 'today'">{{ plural(p.r.sets, 'set') }}</template>
            <template v-else>{{ plural(p.r.sessions, 'session') }} · {{ plural(p.r.sets, 'set') }}</template>
          </span>
        </div>
      </div>
    </section>

    <p class="text-[13px] leading-normal text-neutral-500">
      Weight lifted is weight × reps × sets for every logged exercise, in kg. Dumbbell weights count both hands. The
      baseline assessment has no sets, so it isn't included. "Last 7 days" and "Last 30 days" include today.
    </p>
  </div>
</template>
