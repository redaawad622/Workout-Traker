<script setup lang="ts">
import { convertedFull, convertedShort, fixed1, fmtDay, fmtShort, kgOf, todayISO } from '~/utils/format'
const store = useWorkoutStore()

const dayHeading = (d: string) => (d === todayISO() ? `Today · ${fmtDay(d)}` : fmtDay(d))
</script>

<template>
  <div class="flex flex-col gap-[22px]">
    <div class="flex flex-col gap-2.5">
      <h1 class="text-[28px] font-medium tracking-[-0.01em]">History</h1>
      <div v-if="store.sessions.length" class="flex gap-3.5 text-xs text-neutral-400">
        <span class="flex items-center gap-1.5"><span class="size-2 rounded bg-accent" />Logged</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded shadow-[inset_0_0_0_1.5px_theme(colors.neutral.400)]" />Baseline</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rounded border-[1.5px] border-dashed border-warn" />Unverified</span>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="!store.sessions.length" class="mt-[120px] flex flex-col items-start gap-3">
      <i class="ph ph-clock-counter-clockwise text-[44px] text-neutral-600" />
      <span class="text-xl font-medium">No sessions yet</span>
      <span class="text-[15px] leading-normal text-neutral-400">Logged sets show up here, grouped by day.</span>
      <NuxtLink to="/log" class="btn-outline mt-2 h-12 px-5 text-[15px]"><i class="ph ph-plus-circle" />Go to Log</NuxtLink>
    </div>

    <!-- Sessions, newest first -->
    <section v-for="s in store.sessions" :key="s.date" class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between">
        <h2 class="text-[15px] font-medium">{{ dayHeading(s.date) }}</h2>
        <span v-if="s.bodyWeightKg" class="tnum text-[13px] text-neutral-400">{{ s.bodyWeightKg }} kg body</span>
      </div>
      <ul class="card tnum px-3.5">
        <li
          v-for="(e, i) in s.items"
          :key="e.id"
          class="grid min-h-[52px] grid-cols-[8px_1fr_auto] items-center gap-2.5 py-1.5"
          :class="i < s.items.length - 1 && 'shadow-hairline'"
        >
          <span class="size-1.5 rounded-full bg-accent" />
          <span class="text-[15px]">{{ e.exercise }}</span>
          <span class="text-right text-[15px]">
            {{ e.weight }} {{ e.unit }}<template v-if="e.perDumbbell"> each</template>
            <span class="text-neutral-400"> ≈ {{ convertedShort(e) }}</span>
            <span v-if="e.sets && e.reps" class="block text-xs text-neutral-400">{{ e.sets }} × {{ e.reps }}</span>
          </span>
        </li>
      </ul>
    </section>

    <template v-if="store.assessment.length || store.unverified.length">
      <h2 class="pt-3 text-xl font-medium">Full record</h2>

      <!-- Initial assessment -->
      <section v-if="store.assessment.length" class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between">
          <h3 class="flex items-center gap-2 text-[15px] font-medium">
            <span class="size-2 rounded shadow-[inset_0_0_0_1.5px_theme(colors.neutral.400)]" />Initial assessment
          </h3>
          <span class="text-[13px] text-neutral-400">{{ fmtShort(store.assessment[0].date) }}</span>
        </div>
        <table class="tnum w-full rounded-lg text-sm shadow-sm">
          <thead>
            <tr class="text-xs text-neutral-400 shadow-hairline">
              <th class="h-9 w-[34px] pl-3.5 text-left font-normal">#</th>
              <th class="text-left font-normal">Exercise</th>
              <th class="w-[72px] text-right font-normal">Original</th>
              <th class="w-[66px] pr-3.5 text-right font-normal">kg</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(e, i) in store.assessment" :key="e.id" :class="i < store.assessment.length - 1 && 'shadow-hairline-dim'">
              <td class="h-11 pl-3.5 text-neutral-500">{{ i + 1 }}</td>
              <td class="py-2 pr-2">{{ e.exercise }} <span v-if="e.perDumbbell" class="text-xs text-accent-300">each</span></td>
              <td class="text-right">{{ e.weight }} {{ e.unit }}</td>
              <td class="pr-3.5 text-right text-neutral-400">{{ fixed1(kgOf(e)) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Unverified -->
      <section v-if="store.unverified.length" class="flex flex-col gap-2">
        <h3 class="flex items-center gap-2 text-[15px] font-medium">
          <span class="size-2 rounded border-[1.5px] border-dashed border-warn" />Later updates mentioned in the log
        </h3>
        <p class="flex gap-2.5 rounded-md bg-warn-tint p-3 text-[13px] leading-[1.45] text-warn-text">
          <i class="ph ph-warning flex-none text-lg" />No confirmed date. Excluded from Progress until you confirm them.
        </p>
        <ul class="tnum rounded-lg border border-dashed border-warn-border px-3.5">
          <li
            v-for="(e, i) in store.unverified"
            :key="e.id"
            class="flex flex-col gap-2.5 py-3.5"
            :class="i < store.unverified.length - 1 && 'shadow-hairline'"
          >
            <div class="flex justify-between gap-3 text-[15px]">
              <span>{{ e.exercise }}</span>
              <span class="text-right">{{ e.weight }} {{ e.unit }} <span class="text-neutral-400">≈ {{ convertedFull(e) }}</span></span>
            </div>
            <div class="grid grid-cols-[1fr_48px] gap-2">
              <button class="btn-outline h-11 text-sm" @click="store.confirm(e.id!, e.date)"><i class="ph ph-check" />Confirm</button>
              <button
                :aria-label="`Delete ${e.exercise}`"
                class="flex h-11 items-center justify-center rounded-md text-lg text-neutral-400 shadow-[inset_0_0_0_1px_theme(colors.neutral.800)] active:bg-neutral-900"
                @click="store.remove(e.id!)"
              >
                <i class="ph ph-trash" />
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
