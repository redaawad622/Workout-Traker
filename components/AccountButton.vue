<script setup lang="ts">
// Account shortcut for page headers: "Sign in" when signed out, your initial when signed in.
const account = useAccount()
const show = computed(() => account.enabled && (!!account.user.value || !!account.providers.value?.length))
const initial = computed(() => (account.user.value?.email?.[0] ?? '?').toUpperCase())
</script>

<template>
  <template v-if="show">
    <NuxtLink
      v-if="account.user.value"
      to="/data"
      aria-label="Account"
      class="relative flex size-10 flex-none items-center justify-center rounded-full bg-accent-900 text-base font-medium text-accent-300 shadow-[inset_0_0_0_1px_theme(colors.accent.700)] active:bg-accent-800"
    >
      {{ initial }}
      <span
        v-if="account.state.value !== 'idle'"
        class="absolute -right-0.5 -top-0.5 size-3 rounded-full ring-2 ring-bg"
        :class="account.state.value === 'error' ? 'bg-warn' : 'animate-pulse bg-accent'"
      />
    </NuxtLink>
    <NuxtLink
      v-else
      to="/data"
      class="flex h-10 flex-none items-center gap-1.5 rounded-md px-3 text-sm text-accent-300 shadow-[inset_0_0_0_1px_theme(colors.accent.700)] active:bg-accent-900"
    >
      <i class="ph ph-user-circle text-lg" />Sign in
    </NuxtLink>
  </template>
</template>
