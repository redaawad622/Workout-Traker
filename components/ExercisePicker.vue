<script setup lang="ts">
import type { Entry } from '~/utils/db'
import { exercisePrompt, parseExercise, type AiExercise } from '~/utils/ai'
import { DAY_LABELS, SPLIT_DAYS } from '~/utils/exercises'
import { splitName, weightText } from '~/utils/format'

// Bottom sheet listing the exercises still left for the day, in training order.
defineProps<{
  rows: { n: number; names: string[] }[]
  selected: string
  doneCount: number
  leftCount: number
  lastOf: (name: string) => Entry | undefined
}>()
const emit = defineEmits<{ close: []; select: [name: string, info?: AiExercise] }>()

const custom = ref('')
function add() {
  const name = custom.value.trim()
  if (name) emit('select', name)
}

// Optional: the Claude app tidies the name and says which day and muscles it is; the user checks it first.
const ai = reactive({ result: null as AiExercise | null })
function useResult() {
  const r = ai.result
  if (r?.name.trim()) emit('select', r.name.trim(), { ...r, name: r.name.trim() })
}
const EQUIPMENT: Record<AiExercise['equipment'], string> = {
  machine: 'Machine', cable: 'Cable', dumbbells: 'Dumbbells', barbell: 'Barbell', bodyweight: 'Bodyweight', other: 'Other'
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-40 bg-[color-mix(in_srgb,theme(colors.bg)_70%,transparent)]" @click="emit('close')" />
    <div
      role="dialog"
      aria-label="Pick exercise"
      class="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh-120px)] max-w-2xl flex-col gap-4 rounded-t-sheet bg-surface px-5 pt-2.5 shadow-lg"
      style="padding-bottom: calc(env(safe-area-inset-bottom) + 20px)"
    >
      <span class="h-[5px] w-10 self-center rounded-sm bg-neutral-700" />
      <div class="flex items-baseline justify-between">
        <span class="text-xl font-medium">Pick exercise</span>
        <span class="text-[13px] text-neutral-400"><span class="text-accent-300">{{ doneCount }} done</span> · {{ leftCount }} left</span>
      </div>

      <div class="-mx-5 flex-1 overflow-y-auto px-5">
        <p v-if="!rows.length" class="py-4 text-[15px] text-neutral-400">Everything in your routine is done. Add an extra exercise below.</p>
        <template v-for="(row, i) in rows" :key="row.names.join()">
          <!-- Either / or -->
          <div v-if="row.names.length > 1" class="flex gap-3 py-2.5" :class="i < rows.length - 1 && 'shadow-hairline'">
            <span class="tnum w-5 pt-3.5 text-[13px] text-neutral-500">{{ row.n }}</span>
            <div class="flex flex-1 flex-col gap-1.5">
              <span class="text-xs uppercase tracking-[0.04em] text-neutral-400">Either / or</span>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="name in row.names"
                  :key="name"
                  type="button"
                  class="flex min-h-12 flex-col justify-center rounded-md px-2.5 py-1.5 text-left"
                  :class="name === selected ? 'bg-accent-900 shadow-[inset_0_0_0_1px_theme(colors.accent.700)]' : 'shadow-sm active:bg-neutral-900'"
                  @click="emit('select', name)"
                >
                  <span class="text-[15px]">{{ splitName(name)[0] }}</span>
                  <span v-if="lastOf(name)" class="tnum text-xs text-neutral-400">{{ weightText(lastOf(name)!) }}</span>
                </button>
              </div>
            </div>
          </div>
          <!-- Single exercise -->
          <button
            v-else
            type="button"
            class="flex min-h-14 items-center gap-3 text-left"
            :class="
              row.names[0] === selected
                ? '-mx-3 w-[calc(100%+24px)] rounded-md bg-accent-900 px-3 shadow-[inset_0_0_0_1px_theme(colors.accent.700)]'
                : i < rows.length - 1 && rows[i + 1].names[0] !== selected
                  ? 'w-full shadow-hairline'
                  : 'w-full'
            "
            @click="emit('select', row.names[0])"
          >
            <span class="tnum w-5 text-[13px]" :class="row.names[0] === selected ? 'text-accent-300' : 'text-neutral-500'">{{ row.n }}</span>
            <span class="flex-1 text-base">
              {{ splitName(row.names[0])[0] }}
              <span v-if="splitName(row.names[0])[1]" class="text-[13px] text-neutral-400">{{ splitName(row.names[0])[1] }}</span>
            </span>
            <span v-if="lastOf(row.names[0])" class="tnum text-[13px] text-neutral-400">{{ weightText(lastOf(row.names[0])!) }}</span>
            <i v-if="row.names[0] === selected" class="ph-bold ph-check text-accent-400" />
          </button>
        </template>
      </div>

      <!-- Claude's suggestion, editable before it's used -->
      <div v-if="ai.result" class="flex flex-col gap-3 rounded-lg p-3.5 shadow-[inset_0_0_0_1px_theme(colors.accent.700)]">
        <span class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.06em] text-accent-400"><i class="ph ph-sparkle" />Claude suggests</span>
        <input v-model="ai.result.name" aria-label="Exercise name" class="h-11 rounded-md bg-bg px-3 text-[15px] shadow-sm focus:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]" />
        <span class="text-sm text-neutral-300">{{ EQUIPMENT[ai.result.equipment] }} · {{ ai.result.muscles.join(', ') }}</span>
        <span v-if="ai.result.tip" class="text-xs leading-[1.4] text-neutral-400">{{ ai.result.tip }}</span>
        <div class="grid grid-cols-3 gap-1 rounded-md bg-neutral-900 p-[3px]" role="radiogroup" aria-label="Split day">
          <button
            v-for="d in SPLIT_DAYS"
            :key="d"
            type="button"
            role="radio"
            :aria-checked="ai.result.splitDay === d"
            class="flex h-[34px] items-center justify-center rounded-[6px] text-[13px]"
            :class="ai.result.splitDay === d ? 'bg-accent-800 font-medium text-accent-200' : 'text-neutral-400'"
            @click="ai.result.splitDay = d"
          >
            {{ DAY_LABELS[d] }}
          </button>
        </div>
        <label class="flex items-center justify-between text-[15px]">
          Weight is per dumbbell
          <input v-model="ai.result.perDumbbell" type="checkbox" class="size-5 accent-[theme(colors.accent.DEFAULT)]" />
        </label>
        <div class="flex gap-2">
          <button type="button" class="h-11 flex-1 rounded-md bg-neutral-900 text-[15px] active:bg-neutral-800" @click="ai.result = null">Discard</button>
          <button type="button" class="h-11 flex-1 rounded-md bg-accent-900 text-[15px] font-medium text-accent-100 shadow-[inset_0_0_0_1px_theme(colors.accent.DEFAULT)]" @click="useResult">
            Use it
          </button>
        </div>
      </div>

      <form class="flex gap-2" @submit.prevent="add">
        <label class="flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-md bg-bg px-3.5 shadow-sm focus-within:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]">
          <i class="ph ph-plus text-neutral-500" />
          <input v-model="custom" placeholder="New exercise name" class="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-neutral-500" />
        </label>
        <button
          class="h-[52px] w-16 flex-none rounded-md text-[15px]"
          :class="custom.trim() ? 'text-accent-300 shadow-[inset_0_0_0_1px_theme(colors.accent.DEFAULT)]' : 'text-neutral-400 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)]'"
        >
          Add
        </button>
      </form>
      <ClaudeAsk v-if="custom.trim() && !ai.result" :prompt="exercisePrompt(custom.trim())" :parse="parseExercise" @result="(r) => (ai.result = r)" />
    </div>
  </Teleport>
</template>
