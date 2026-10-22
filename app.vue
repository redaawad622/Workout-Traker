<script setup lang="ts">
const store = useWorkoutStore()
onMounted(() => store.load())
const links = [
  { to: '/', label: 'History' },
  { to: '/log', label: 'Log' },
  { to: '/progress', label: 'Progress' },
  { to: '/data', label: 'Data' }
]
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 pb-24">
    <main class="mx-auto max-w-2xl px-4 pt-6">
      <NuxtPage v-if="store.ready" />
      <p v-else class="text-slate-400">Loading…</p>
    </main>
    <nav
      class="fixed bottom-0 inset-x-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <ul class="mx-auto flex max-w-2xl">
        <li v-for="l in links" :key="l.to" class="flex-1">
          <NuxtLink
            :to="l.to"
            class="block py-3 text-center text-sm text-slate-400"
            active-class="!text-emerald-400 font-semibold"
          >
            {{ l.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
