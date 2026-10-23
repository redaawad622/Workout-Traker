<script setup lang="ts">
import { fixed1, fmtShort, kgOf, signed, splitName, todayISO } from '~/utils/format'
import { MAX_SESSIONS_TO_SWITCH } from '~/stores/workout'

const store = useWorkoutStore()
const route = useRoute()
const router = useRouter()

// No ?e= → summary of every exercise; ?e=Name → that exercise's trend.
const selected = computed(() => (typeof route.query.e === 'string' ? route.query.e : ''))
const open = (e: string) => router.push({ query: { e } })

// ---- Summary ----
const summary = computed(() => store.summary)
const comparable = computed(() => summary.value.filter((s) => s.previous))
const upCount = computed(() => comparable.value.filter((s) => (s.deltaKg ?? 0) > 0).length)
// Exercises with two or more logs first, the ones still waiting for a second log last.
const ordered = computed(() => [...comparable.value, ...summary.value.filter((s) => !s.previous)])

// ---- One exercise ----
const rows = computed(() => store.byExercise(selected.value)) // newest first
const latest = computed(() => rows.value[0])
const previous = computed(() => rows.value[1])
const delta = computed(() => (previous.value ? kgOf(latest.value) - kgOf(previous.value) : 0))
const baseline = computed(() => [...rows.value].reverse().find((r) => r.source === 'assessment') ?? rows.value[rows.value.length - 1])
const points = computed(() =>
  [...rows.value].reverse().map((r) => ({ date: r.date, kg: kgOf(r), baseline: r.source === 'assessment' }))
)
const max = computed(() => store.machineMax[selected.value])
const atMaxCount = computed(() => store.datesAtMax(selected.value).length)
const when = (d: string) => (d === todayISO() ? 'today' : `on ${fmtShort(d)}`)
</script>

<template>
  <!-- ========== One exercise ========== -->
  <div v-if="selected" class="flex flex-col gap-5">
    <div class="flex items-center gap-2.5">
      <NuxtLink to="/progress" aria-label="All exercises" class="-ml-2.5 flex size-11 items-center justify-center text-[22px] text-neutral-300">
        <i class="ph ph-caret-left" />
      </NuxtLink>
      <label class="card relative flex h-11 flex-1 items-center justify-between px-3.5 text-base">
        <span class="truncate">{{ selected }}</span>
        <i class="ph ph-caret-down text-neutral-500" />
        <select
          :value="selected"
          aria-label="Exercise"
          class="absolute inset-0 opacity-0"
          @change="open(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="e in store.exercises" :key="e" :value="e">{{ e }}</option>
        </select>
      </label>
    </div>

    <template v-if="rows.length > 1">
      <div class="tnum flex flex-col gap-1.5">
        <span class="text-[60px] font-medium leading-none tracking-[-0.03em]" :class="delta >= 0 ? 'text-accent-300' : 'text-neutral-300'">
          {{ signed(delta) }}<span class="ml-1 text-[22px] tracking-normal">kg</span>
        </span>
        <span class="text-[15px] text-neutral-300">
          {{ fixed1(kgOf(latest)) }} kg {{ when(latest.date) }} vs {{ fixed1(kgOf(previous)) }} kg on {{ fmtShort(previous.date) }}
        </span>
        <span class="text-[13px] text-neutral-400">
          {{ signed(kgOf(latest) - kgOf(baseline)) }} kg since {{ baseline.source === 'assessment' ? 'baseline' : 'first log' }} · {{ rows.length }} logs
        </span>
      </div>
      <TrendChart :points="points" />
    </template>
    <div v-else class="flex h-[220px] flex-col justify-end gap-2 rounded-lg border border-dashed border-neutral-700 p-5">
      <i class="ph ph-chart-line-up text-[32px] text-neutral-600" />
      <span class="text-base leading-[1.45] text-neutral-300">Log this exercise at least twice to see a trend</span>
    </div>

    <div v-if="max" class="card tnum flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
      <span class="text-neutral-300">Machine max {{ max.weight }} {{ max.unit }} <span class="text-neutral-500">≈ {{ fixed1(kgOf(max)) }} kg</span></span>
      <span :class="atMaxCount >= MAX_SESSIONS_TO_SWITCH ? 'text-warn-text' : 'text-neutral-400'">
        {{ atMaxCount ? `at max ${atMaxCount}×` : `${rows.length ? Math.round((kgOf(latest) / kgOf(max)) * 100) : 0}% of max` }}
      </span>
    </div>

    <div v-if="rows.length" class="flex flex-col gap-2">
      <span class="label">All logs</span>
      <ul class="tnum rounded-lg px-3.5 text-sm shadow-sm">
        <li
          v-for="(r, i) in rows"
          :key="r.id"
          class="grid min-h-11 grid-cols-[1fr_auto_46px_52px] items-center gap-2"
          :class="i < rows.length - 1 && 'shadow-hairline-dim'"
        >
          <span class="flex items-center gap-1.5">
            {{ fmtShort(r.date) }}
            <span v-if="r.source === 'assessment'" class="rounded-sm px-1.5 py-px text-[11px] text-neutral-400 shadow-[inset_0_0_0_1px_theme(colors.neutral.600)]">Baseline</span>
          </span>
          <span class="text-right">{{ r.weight }} {{ r.unit }}<template v-if="r.perDumbbell"> each</template></span>
          <span class="text-right text-neutral-300">{{ fixed1(kgOf(r)) }}</span>
          <span class="text-right" :class="r.sets && r.reps ? 'text-neutral-400' : 'text-neutral-500'">
            {{ r.sets && r.reps ? `${r.sets}×${r.reps}` : '—' }}
          </span>
        </li>
      </ul>
    </div>
  </div>

  <!-- ========== Summary ========== -->
  <div v-else class="flex flex-col gap-5">
    <h1 class="text-[28px] font-medium tracking-[-0.01em]">Progress</h1>
    <template v-if="summary.length">
      <div v-if="comparable.length" class="flex flex-col gap-1">
        <span class="tnum text-[52px] font-medium leading-none tracking-[-0.03em]">
          {{ upCount }} <span class="text-[22px] tracking-normal text-neutral-400">of {{ comparable.length }} up</span>
        </span>
        <span class="text-sm text-neutral-400">Latest log vs the one before, in kg</span>
      </div>
      <ul class="card tnum px-3.5">
        <li v-for="(s, i) in ordered" :key="s.exercise" :class="i < ordered.length - 1 && 'shadow-hairline'">
          <button
            v-if="s.previous"
            class="grid min-h-14 w-full grid-cols-[1fr_auto_70px_14px] items-center gap-2.5 text-left"
            @click="open(s.exercise)"
          >
            <span class="text-[15px]">{{ splitName(s.exercise)[0] }}</span>
            <span class="text-sm text-neutral-400">{{ fixed1(kgOf(s.latest)) }}</span>
            <span
              class="text-right text-[15px]"
              :class="s.deltaKg! > 0 ? 'font-medium text-accent-300' : s.deltaKg! < 0 ? 'text-neutral-300' : 'text-neutral-400'"
            >
              {{ signed(s.deltaKg!) }}
              <i v-if="s.deltaKg! > 0" class="ph-bold ph-arrow-up-right" />
              <i v-else-if="s.deltaKg! < 0" class="ph-bold ph-arrow-down-right" />
            </span>
            <i class="ph ph-caret-right text-neutral-600" />
          </button>
          <button v-else class="grid min-h-14 w-full grid-cols-[1fr_auto_14px] items-center gap-2.5 text-left" @click="open(s.exercise)">
            <span class="text-[15px] text-neutral-400">{{ splitName(s.exercise)[0] }}</span>
            <span class="text-[13px] text-neutral-500">1 log · needs another</span>
            <i class="ph ph-caret-right text-neutral-600" />
          </button>
        </li>
      </ul>
    </template>
    <div v-else class="mt-[120px] flex flex-col items-start gap-3">
      <i class="ph ph-chart-line-up text-[44px] text-neutral-600" />
      <span class="text-xl font-medium">Nothing to compare yet</span>
      <span class="text-[15px] leading-normal text-neutral-400">Log an exercise twice to see whether you're getting stronger.</span>
    </div>
  </div>
</template>
