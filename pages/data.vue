<script setup lang="ts">
const store = useWorkoutStore()
const msg = ref('')

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

async function onImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!confirm('This replaces all current data with the file contents. Continue?')) return
  try {
    await store.importJson(await file.text())
    msg.value = 'Imported.'
  } catch {
    msg.value = 'That file is not a valid workout backup.'
  }
}

const btn = 'w-full rounded-lg bg-slate-800 py-3 active:bg-slate-700'
</script>

<template>
  <div class="space-y-3">
    <h1 class="mb-2 text-2xl font-bold">Data</h1>
    <p class="text-sm text-slate-400">
      Everything is stored on this device (IndexedDB). Export a backup before clearing browser data.
    </p>
    <button :class="btn" @click="download('workout-log.json', store.exportJson(), 'application/json')">Export JSON backup</button>
    <button :class="btn" @click="download('workout-log.md', store.exportMarkdown(), 'text/markdown')">Export Markdown</button>
    <label :class="[btn, 'block cursor-pointer text-center']">
      Import JSON backup
      <input type="file" accept="application/json" class="hidden" @change="onImport" />
    </label>
    <p v-if="msg" class="text-emerald-400">{{ msg }}</p>
  </div>
</template>
