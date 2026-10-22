<script setup lang="ts">
import { parseBackup } from '~/stores/workout'
import { todayISO } from '~/utils/format'
import { useDietStore } from '~/stores/diet'

const store = useWorkoutStore()
const diet = useDietStore()
const status = ref<{ ok: boolean; text: string; file?: string } | null>(null)
const pending = ref<{ file: string; json: string; meals: boolean } | null>(null)
const pendingHasMeals = computed(() => !!pending.value?.meals)

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
  status.value = { ok: true, text: `${type.includes('json') ? 'Backup' : 'Table'} saved · ${name}` }
}

// Check the file before asking, so a wrong file never reaches the confirm step.
async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const json = await file.text()
  try {
    const backup = parseBackup(json)
    pending.value = { file: file.name, json, meals: !!backup.meals }
  } catch {
    status.value = { ok: false, text: "isn't a Workout Log backup. Nothing was changed.", file: file.name }
  }
}

async function replace() {
  const p = pending.value!
  pending.value = null
  try {
    const data = await store.importJson(p.json)
    await diet.load(store.latestBodyWeight)
    const meals = data.meals ? ` and ${data.meals.length} meals` : ''
    status.value = { ok: true, text: `Imported ${store.entries.length} entries${meals} · ${p.file}` }
  } catch {
    status.value = { ok: false, text: "isn't a Workout Log backup. Nothing was changed.", file: p.file }
  }
}

async function exportBackup() {
  download(`workout-log-${todayISO()}.json`, await store.exportJson(), 'application/json')
}

const failed = computed(() => status.value && !status.value.ok)
</script>

<template>
  <div class="flex flex-col gap-5">
    <h1 class="text-[28px] font-medium tracking-[-0.01em]">Data</h1>

    <div class="flex items-start gap-3">
      <i class="ph ph-device-mobile flex-none text-2xl text-accent-400" />
      <div class="flex flex-col gap-1.5">
        <span class="text-[15px] leading-normal">Your data lives only on this phone. No account, no sync.</span>
        <span class="text-sm leading-normal text-neutral-400">Export a backup regularly. Deleting the app deletes your log.</span>
      </div>
    </div>

    <div
      v-if="status?.ok"
      role="status"
      class="flex items-center gap-2.5 rounded-md bg-accent-900 px-3.5 py-3 text-sm text-accent-200 shadow-[inset_0_0_0_1px_theme(colors.accent.700)]"
    >
      <i class="ph-fill ph-check-circle flex-none text-lg text-accent-400" /><span>{{ status.text }}</span>
    </div>
    <div
      v-else-if="status"
      role="alert"
      class="flex gap-2.5 rounded-md bg-warn-tint px-3.5 py-3 text-sm leading-[1.45] text-warn-text shadow-[inset_0_0_0_1px_theme(colors.warn.border)]"
    >
      <i class="ph ph-warning-circle flex-none text-lg" />
      <span><span class="font-medium">Import failed.</span> {{ status.file }} {{ status.text }}</span>
    </div>

    <section class="flex flex-col gap-2.5">
      <h2 class="label">Export</h2>
      <button
        class="card flex min-h-[60px] items-center gap-3.5 px-4 text-left active:bg-neutral-900"
        @click="exportBackup"
      >
        <i class="ph ph-download-simple text-[22px] text-accent-400" />
        <span class="flex flex-1 flex-col"><span class="text-base">JSON backup</span><span class="text-xs text-neutral-400">Workouts and meals, can be re-imported</span></span>
      </button>
      <button
        class="card flex min-h-[60px] items-center gap-3.5 px-4 text-left active:bg-neutral-900"
        @click="download(`workout-log-${todayISO()}.md`, store.exportMarkdown(), 'text/markdown')"
      >
        <i class="ph ph-table text-[22px] text-accent-400" />
        <span class="flex flex-1 flex-col"><span class="text-base">Markdown table</span><span class="text-xs text-neutral-400">Readable, for notes or sharing</span></span>
      </button>
    </section>

    <section class="flex flex-col gap-2.5">
      <h2 class="label">Import</h2>
      <label
        class="flex min-h-[60px] cursor-pointer items-center gap-3.5 rounded-lg px-4 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent active:bg-neutral-900"
      >
        <i class="ph ph-upload-simple text-[22px] text-neutral-300" />
        <span class="flex flex-1 flex-col">
          <span class="text-base">{{ failed ? 'Try another file' : 'Import JSON backup' }}</span>
          <span class="text-xs text-neutral-400">Replaces all data on this phone</span>
        </span>
        <input type="file" accept="application/json,.json" class="sr-only" @change="onPick" />
      </label>
    </section>

    <!-- Confirm before replacing everything -->
    <Teleport to="body">
      <template v-if="pending">
        <div class="fixed inset-0 z-40 bg-[color-mix(in_srgb,theme(colors.bg)_75%,transparent)]" @click="pending = null" />
        <div
          role="alertdialog"
          aria-labelledby="replace-title"
          class="fixed inset-x-4 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-xl bg-surface px-5 pb-5 pt-[22px] shadow-lg"
          style="bottom: calc(env(safe-area-inset-bottom) + 24px)"
        >
          <h2 id="replace-title" class="text-xl font-medium">Replace all data?</h2>
          <p class="text-[15px] leading-normal text-neutral-300">
            {{ pending.file }} will replace the {{ store.entries.length }} entries<template v-if="pendingHasMeals"> and {{ diet.meals.length }} meals</template> on this phone. This can't be undone.
          </p>
          <div class="mt-2 flex flex-col gap-2">
            <button class="h-[52px] rounded-md text-base font-medium text-warn-text shadow-[inset_0_0_0_1px_theme(colors.warn.line)] active:bg-warn-tint" @click="replace">
              Replace data
            </button>
            <button class="h-[52px] rounded-md bg-neutral-900 text-base active:bg-neutral-800" @click="pending = null">Cancel</button>
          </div>
        </div>
      </template>
    </Teleport>
  </div>
</template>
