<script setup lang="ts">
import { isBuiltIn, newId, type Program } from '~/utils/exercises'

const store = useWorkoutStore()

// The program being made or edited. Its days include deleted ones, which stay hidden.
const draft = ref<Program | null>(null)
const adding = reactive<Record<string, string>>({})

const summary = (p: Program) => {
  const days = p.days.filter((d) => !d.deleted)
  return days.length > 1 ? `${days.length} days · ${days.map((d) => d.name).join(', ')}` : `${days[0]?.exercises.length ?? 0} exercises`
}

const blankDay = (n: number) => ({ id: newId(), name: `Day ${n}`, exercises: [] as string[] })

function create() {
  draft.value = { id: newId(), name: '', days: [blankDay(1)] }
}

// Built-in programs can't be changed here, but you can start a new one from a copy.
function copy(p: Program) {
  draft.value = {
    id: newId(),
    name: `${p.name} (copy)`,
    days: p.days.filter((d) => !d.deleted).map((d) => ({ id: newId(), name: d.name, exercises: [...d.exercises] }))
  }
}

function edit(p: Program) {
  draft.value = structuredClone(toRaw(p))
}

const visibleDays = computed(() => draft.value?.days.filter((d) => !d.deleted) ?? [])

function addDay() {
  draft.value!.days.push(blankDay(visibleDays.value.length + 1))
}

// A day past dates were trained on is hidden instead of removed, so they keep their name.
function removeDay(id: string) {
  const p = draft.value!
  const day = p.days.find((d) => d.id === id)!
  if (day.exercises.length && !confirm(`Remove ${day.name || 'this day'}?`)) return
  if (store.isUsed(p.id, id)) day.deleted = true
  else p.days = p.days.filter((d) => d.id !== id)
}

function addExercise(dayId: string) {
  const name = adding[dayId]?.trim()
  const day = draft.value!.days.find((d) => d.id === dayId)!
  if (name && !day.exercises.includes(name)) day.exercises.push(name)
  adding[dayId] = ''
}

function move(list: string[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
}

const problem = computed(() => {
  const p = draft.value
  if (!p) return ''
  if (!p.name.trim()) return 'Give the program a name'
  if (store.programs.some((x) => x.id !== p.id && x.name.trim().toLowerCase() === p.name.trim().toLowerCase())) return 'A program with this name exists'
  if (visibleDays.value.some((d) => !d.name.trim())) return 'Every day needs a name'
  if (visibleDays.value.some((d) => !d.exercises.length)) return 'Every day needs at least one exercise'
  return ''
})

async function save() {
  const p = draft.value
  if (!p || problem.value) return
  p.name = p.name.trim()
  p.days.forEach((d) => (d.name = d.name.trim()))
  await store.saveProgram(p)
  draft.value = null
}

async function remove(p: Program) {
  if (!confirm(`Delete ${p.name}? Days you already logged keep their entries.`)) return
  await store.deleteProgram(p.id)
  draft.value = null
}

const isNew = computed(() => !!draft.value && !store.customPrograms.some((p) => p.id === draft.value!.id))
</script>

<template>
  <div class="flex flex-col gap-5 pb-8">
    <div class="flex items-center gap-1">
      <button
        v-if="draft"
        type="button"
        aria-label="Back to programs"
        class="-ml-2.5 flex size-11 items-center justify-center text-[22px] text-neutral-300"
        @click="draft = null"
      >
        <i class="ph ph-caret-left" />
      </button>
      <NuxtLink v-else to="/log" aria-label="Log" class="-ml-2.5 flex size-11 items-center justify-center text-[22px] text-neutral-300">
        <i class="ph ph-caret-left" />
      </NuxtLink>
      <h1 class="text-[28px] font-medium tracking-[-0.01em]">{{ draft ? (isNew ? 'New program' : 'Edit program') : 'Programs' }}</h1>
    </div>

    <!-- ========== List ========== -->
    <template v-if="!draft">
      <ul class="flex flex-col gap-2.5">
        <li v-for="p in store.programs" :key="p.id" class="card flex items-center gap-3 p-4">
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="flex items-center gap-2 text-base font-medium">
              <span class="truncate">{{ p.name }}</span>
              <span v-if="store.program === p.id" class="chip h-6 flex-none bg-accent-900 text-xs text-accent-200">Current</span>
            </span>
            <span class="truncate text-[13px] text-neutral-400">{{ isBuiltIn(p.id) ? 'Built in · ' : '' }}{{ summary(p) }}</span>
          </div>
          <button
            v-if="isBuiltIn(p.id)"
            type="button"
            class="flex h-10 flex-none items-center gap-1.5 rounded-md px-3 text-sm text-neutral-300 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)] active:bg-neutral-900"
            @click="copy(p)"
          >
            <i class="ph ph-copy" />Copy
          </button>
          <template v-else>
            <button
              type="button"
              :aria-label="`Delete ${p.name}`"
              class="flex size-10 flex-none items-center justify-center rounded-md text-lg text-neutral-400 active:bg-neutral-900"
              @click="remove(p)"
            >
              <i class="ph ph-trash" />
            </button>
            <button type="button" class="btn-outline h-10 flex-none px-3 text-sm" @click="edit(p)">
              <i class="ph ph-pencil-simple" />Edit
            </button>
          </template>
        </li>
      </ul>

      <button type="button" class="btn-outline h-[52px] text-[15px]" @click="create">
        <i class="ph ph-plus" />New program
      </button>
      <p class="text-[13px] leading-normal text-neutral-400">
        Pick a program at the top of Log. Days rotate in order, so the next workout is the day after the last one you logged.
      </p>
    </template>

    <!-- ========== Editor ========== -->
    <form v-else class="flex flex-col gap-5" @submit.prevent="save">
      <label class="flex flex-col gap-2">
        <span class="label">Name</span>
        <input
          v-model="draft.name"
          placeholder="e.g. Upper / Lower"
          class="h-[52px] rounded-md bg-surface px-3.5 text-base shadow-sm placeholder:text-neutral-500 focus:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]"
        />
      </label>

      <section v-for="(day, di) in visibleDays" :key="day.id" class="card flex flex-col gap-3 p-4">
        <div class="flex items-center gap-2">
          <span class="tnum w-5 text-[13px] text-neutral-500">{{ di + 1 }}</span>
          <input
            v-model="day.name"
            aria-label="Day name"
            placeholder="Day name"
            class="h-11 min-w-0 flex-1 rounded-md bg-bg px-3 text-[15px] font-medium shadow-sm placeholder:text-neutral-500 focus:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]"
          />
          <button
            v-if="visibleDays.length > 1"
            type="button"
            :aria-label="`Remove ${day.name}`"
            class="flex size-11 flex-none items-center justify-center rounded-md text-lg text-neutral-400 active:bg-neutral-900"
            @click="removeDay(day.id)"
          >
            <i class="ph ph-x" />
          </button>
        </div>

        <ul v-if="day.exercises.length" class="flex flex-col">
          <li
            v-for="(ex, i) in day.exercises"
            :key="ex"
            class="flex min-h-12 items-center gap-1"
            :class="i < day.exercises.length - 1 && 'shadow-hairline'"
          >
            <span class="min-w-0 flex-1 truncate text-[15px]">{{ ex }}</span>
            <button
              type="button"
              :aria-label="`Move ${ex} up`"
              :disabled="i === 0"
              class="flex size-9 items-center justify-center text-neutral-400 disabled:text-neutral-700"
              @click="move(day.exercises, i, -1)"
            >
              <i class="ph ph-arrow-up" />
            </button>
            <button
              type="button"
              :aria-label="`Move ${ex} down`"
              :disabled="i === day.exercises.length - 1"
              class="flex size-9 items-center justify-center text-neutral-400 disabled:text-neutral-700"
              @click="move(day.exercises, i, 1)"
            >
              <i class="ph ph-arrow-down" />
            </button>
            <button
              type="button"
              :aria-label="`Remove ${ex}`"
              class="flex size-9 items-center justify-center text-neutral-400"
              @click="day.exercises.splice(i, 1)"
            >
              <i class="ph ph-x" />
            </button>
          </li>
        </ul>

        <div class="flex gap-2">
          <label class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md bg-bg px-3 shadow-sm focus-within:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]">
            <i class="ph ph-plus text-neutral-500" />
            <input
              v-model="adding[day.id]"
              list="known-exercises"
              placeholder="Add exercise"
              class="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-neutral-500"
              @keydown.enter.prevent="addExercise(day.id)"
            />
          </label>
          <button
            type="button"
            class="h-11 w-16 flex-none rounded-md text-[15px]"
            :class="adding[day.id]?.trim() ? 'text-accent-300 shadow-[inset_0_0_0_1px_theme(colors.accent.DEFAULT)]' : 'text-neutral-400 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)]'"
            @click="addExercise(day.id)"
          >
            Add
          </button>
        </div>
      </section>

      <datalist id="known-exercises">
        <option v-for="e in store.knownExercises" :key="e" :value="e" />
      </datalist>

      <button
        type="button"
        class="flex h-12 items-center justify-center gap-2 rounded-lg text-[15px] text-neutral-200 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)] active:bg-neutral-900"
        @click="addDay"
      >
        <i class="ph ph-plus" />Add a day
      </button>

      <div class="flex flex-col gap-2">
        <span v-if="problem" class="text-[13px] text-neutral-400">{{ problem }}</span>
        <button
          :disabled="!!problem"
          class="flex h-14 items-center justify-center gap-2 rounded-lg text-[17px] font-medium"
          :class="problem ? 'text-neutral-500 shadow-[inset_0_0_0_1.5px_theme(colors.neutral.700)]' : 'bg-accent-900 text-accent-100 shadow-[inset_0_0_0_1.5px_theme(colors.accent.DEFAULT)] active:bg-accent-800'"
        >
          <i class="ph-bold ph-check" />Save program
        </button>
        <button
          v-if="!isNew"
          type="button"
          class="flex h-12 items-center justify-center gap-2 rounded-lg text-[15px] text-warn-text shadow-[inset_0_0_0_1px_theme(colors.warn.line)] active:bg-warn-tint"
          @click="remove(draft)"
        >
          <i class="ph ph-trash" />Delete program
        </button>
      </div>
    </form>
  </div>
</template>
