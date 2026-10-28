<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { parseBackup } from '~/stores/workout'
import { todayISO } from '~/utils/format'
import { useDietStore } from '~/stores/diet'

const store = useWorkoutStore()
const diet = useDietStore()
const status = ref<{ ok: boolean; text: string; file?: string } | null>(null)
const pending = ref<{ file: string; json: string; meals: boolean } | null>(null)
const pendingHasMeals = computed(() => !!pending.value?.meals)

async function download(name: string, text: string, type: string) {
  if (Capacitor.isNativePlatform()) {
    // The iOS web view ignores <a download>, so write the file and open the share sheet.
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    try {
      await Share.share({ title: name, files: [uri] })
    } catch {
      return // share sheet dismissed
    }
  } else {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    a.click()
    URL.revokeObjectURL(url)
  }
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
    status.value = { ok: false, text: "isn't a Workout Tracker backup. Nothing was changed.", file: file.name }
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
    status.value = { ok: false, text: "isn't a Workout Tracker backup. Nothing was changed.", file: p.file }
  }
}

async function exportBackup() {
  download(`workout-log-${todayISO()}.json`, await store.exportJson(), 'application/json')
}

const failed = computed(() => status.value && !status.value.ok)

const account = useAccount()
const providerLabel = { google: 'Google', apple: 'Apple' } as const
// Shown once at least one sign-in option is turned on in Supabase (or while offline).
const showAccount = computed(() => account.enabled && (!!account.user.value || !!account.providers.value?.length || account.offline.value))
const confirmDelete = ref(false)
const deleting = ref(false)
const deleteError = ref('')
async function deleteAccount() {
  deleting.value = true
  deleteError.value = ''
  try {
    await account.deleteAccount()
    confirmDelete.value = false
    status.value = { ok: true, text: 'Account deleted · your log is still on this phone' }
  } catch {
    deleteError.value = "Couldn't delete the account. Check your connection and try again."
  } finally {
    deleting.value = false
  }
}
const syncedAgo = computed(() => {
  const t = account.lastSync.value
  if (!t) return 'Not synced yet'
  const min = Math.round((Date.now() - t) / 60000)
  return min < 1 ? 'Synced just now' : min < 60 ? `Synced ${min} min ago` : `Synced ${new Date(t).toLocaleString()}`
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-1">
      <NuxtLink to="/reports" aria-label="Reports" class="-ml-2.5 flex size-11 items-center justify-center text-[22px] text-neutral-300">
        <i class="ph ph-caret-left" />
      </NuxtLink>
      <h1 class="text-[28px] font-medium tracking-[-0.01em]">{{ showAccount ? 'Account & data' : 'Data' }}</h1>
    </div>

    <div v-if="account.user.value" class="flex items-start gap-3">
      <i class="ph ph-cloud-check flex-none text-2xl text-accent-400" />
      <div class="flex flex-col gap-1.5">
        <span class="text-[15px] leading-normal">Your data lives on this phone and syncs to your account.</span>
        <span class="text-sm leading-normal text-neutral-400">Sign in on another device to get the same log there.</span>
      </div>
    </div>
    <div v-else class="flex items-start gap-3">
      <i class="ph ph-device-mobile flex-none text-2xl text-accent-400" />
      <div class="flex flex-col gap-1.5">
        <span class="text-[15px] leading-normal">Your data lives only on this phone<template v-if="!showAccount">. No account, no sync</template>.</span>
        <span class="text-sm leading-normal text-neutral-400">Export a backup regularly<template v-if="showAccount">, or sign in below to back up and sync</template>. Deleting the app deletes your log.</span>
      </div>
    </div>

    <section v-if="showAccount" class="flex flex-col gap-2.5">
      <h2 class="label">Account <span class="normal-case tracking-normal text-neutral-500">· optional</span></h2>
      <div v-if="account.user.value" class="card flex flex-col gap-3 p-4">
        <div class="flex items-center gap-3">
          <i class="ph ph-user-circle text-[28px] text-accent-400" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-base">{{ account.user.value.email ?? 'Signed in' }}</span>
            <span class="text-xs text-neutral-400" role="status">
              <template v-if="account.state.value === 'syncing'">Syncing…</template>
              <template v-else-if="account.state.value === 'error'">{{ account.error.value }}</template>
              <template v-else>{{ syncedAgo }}</template>
            </span>
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button
            class="flex h-11 items-center justify-center gap-1.5 rounded-md bg-neutral-900 text-sm active:bg-neutral-800 disabled:opacity-60"
            :disabled="account.state.value === 'syncing'"
            @click="account.syncNow()"
          >
            <i class="ph ph-arrows-clockwise" :class="{ 'animate-spin': account.state.value === 'syncing' }" />Sync now
          </button>
          <button class="flex h-11 items-center justify-center gap-1.5 rounded-md text-sm text-neutral-300 shadow-sm active:bg-neutral-900" @click="account.signOut()">
            <i class="ph ph-sign-out" />Sign out
          </button>
        </div>
        <span class="text-xs leading-normal text-neutral-500">Signing out keeps everything on this phone.</span>
        <button class="self-start text-sm text-warn-text underline-offset-2 active:underline" @click="confirmDelete = true">Delete account</button>
      </div>
      <template v-else>
        <button
          v-for="p in account.providers.value"
          :key="p"
          class="card flex min-h-[52px] items-center justify-center gap-2.5 px-4 text-base active:bg-neutral-900 disabled:opacity-60"
          :disabled="account.busy.value"
          @click="account.signIn(p)"
        >
          <i class="text-xl" :class="p === 'apple' ? 'ph-fill ph-apple-logo' : 'ph-bold ph-google-logo'" />Continue with {{ providerLabel[p] }}
        </button>
        <p v-if="account.offline.value" class="text-sm text-neutral-400">You're offline. Sign-in needs a connection.</p>
        <p v-if="account.error.value" role="alert" class="text-sm text-warn-text">{{ account.error.value }}</p>
        <span class="text-xs leading-normal text-neutral-500">Signing in uploads this phone's log and merges it with your account. Nothing here is deleted.</span>
      </template>
    </section>

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

    <p class="flex gap-4 text-sm text-neutral-400">
      <NuxtLink to="/privacy" class="underline underline-offset-2">Privacy policy</NuxtLink>
      <NuxtLink to="/support" class="underline underline-offset-2">Support</NuxtLink>
    </p>

    <!-- Confirm before deleting the account -->
    <Teleport to="body">
      <template v-if="confirmDelete">
        <div class="fixed inset-0 z-40 bg-[color-mix(in_srgb,theme(colors.bg)_75%,transparent)]" @click="confirmDelete = false" />
        <div
          role="alertdialog"
          aria-labelledby="delete-title"
          class="fixed inset-x-4 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-xl bg-surface px-5 pb-5 pt-[22px] shadow-lg"
          style="bottom: calc(env(safe-area-inset-bottom) + 24px)"
        >
          <h2 id="delete-title" class="text-xl font-medium">Delete your account?</h2>
          <p class="text-[15px] leading-normal text-neutral-300">
            This deletes {{ account.user.value?.email ?? 'your account' }} and everything synced to it, including Money Tracker and Azkar Tracker data on the same account. Your log stays on this phone. This can't be undone.
          </p>
          <p v-if="deleteError" role="alert" class="text-sm text-warn-text">{{ deleteError }}</p>
          <div class="mt-2 flex flex-col gap-2">
            <button
              class="h-[52px] rounded-md text-base font-medium text-warn-text shadow-[inset_0_0_0_1px_theme(colors.warn.line)] active:bg-warn-tint disabled:opacity-60"
              :disabled="deleting"
              @click="deleteAccount"
            >
              {{ deleting ? 'Deleting…' : 'Delete account' }}
            </button>
            <button class="h-[52px] rounded-md bg-neutral-900 text-base active:bg-neutral-800" @click="confirmDelete = false">Cancel</button>
          </div>
        </div>
      </template>
    </Teleport>

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
