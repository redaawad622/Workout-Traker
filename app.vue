<script setup lang="ts">
const store = useWorkoutStore()
onMounted(() => store.load())
const links = [
  { to: '/', label: 'History', icon: 'clock-counter-clockwise' },
  { to: '/log', label: 'Log', icon: 'plus-circle' },
  { to: '/progress', label: 'Progress', icon: 'chart-line-up' },
  { to: '/data', label: 'Data', icon: 'database' }
]
const route = useRoute()
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
  <div class="min-h-screen bg-bg text-ink" style="padding-bottom: calc(var(--tabbar) + 32px)">
    <main class="mx-auto max-w-2xl overflow-x-clip px-5" style="padding-top: calc(env(safe-area-inset-top) + 12px)">
      <NuxtPage v-if="store.ready" />
      <p v-else class="pt-4 text-neutral-400">Loading…</p>
    </main>
    <nav
      class="fixed inset-x-0 bottom-0 z-30 bg-bg shadow-[0_-1px_0_theme(colors.neutral.900)]"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <ul class="mx-auto grid h-[49px] max-w-2xl grid-cols-4">
        <li v-for="l in links" :key="l.to">
          <NuxtLink
            :to="l.to"
            class="relative flex h-full flex-col items-center justify-center gap-[3px] text-[11px] font-medium tracking-[0.01em]"
            :class="isActive(l.to) ? 'text-accent-400' : 'text-neutral-500'"
          >
            <span v-if="isActive(l.to)" class="absolute top-0 h-0.5 w-7 rounded-sm bg-accent" />
            <i :class="[isActive(l.to) ? 'ph-fill' : 'ph', `ph-${l.icon}`]" class="text-2xl leading-none" />
            {{ l.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style>
:root {
  --tabbar: calc(49px + env(safe-area-inset-bottom));
}
</style>
