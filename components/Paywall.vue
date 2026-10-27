<script setup lang="ts">
// Shows nothing until subscriptions are turned on (see composables/useSubscription.ts).
// Notice period: a banner with the days left, plus the plans sheet the first time.
// After it: a subscribe screen over the app, except on Account & data, which always stays
// open so people can export their log or sign in.
const sub = useSubscription()
const route = useRoute()
const hidden = ref(false) // banner closed for this visit
const onData = computed(() => route.path.startsWith('/data'))
const blocking = computed(() => sub.phase.value === 'due' && !onData.value)
const banner = computed(() => (sub.phase.value === 'notice' && !hidden.value) || (sub.phase.value === 'due' && onData.value))
const days = computed(() => (sub.daysLeft.value === 1 ? '1 day' : `${sub.daysLeft.value} days`))
</script>

<template>
  <div v-if="banner" class="mb-4 flex items-center gap-3 rounded-md bg-accent-900 py-2.5 pl-3.5 pr-1.5 shadow-[inset_0_0_0_1px_theme(colors.accent.700)]">
    <i class="ph ph-crown-simple flex-none text-xl text-accent-400" />
    <span class="flex-1 text-sm leading-snug text-accent-200">
      <template v-if="sub.phase.value === 'notice'">Workout Tracker needs a subscription in {{ days }}.</template>
      <template v-else>A subscription is needed to keep logging.</template>
    </span>
    <button class="h-9 rounded-md px-2.5 text-sm font-medium text-accent-300 active:bg-accent-800" @click="sub.sheet.value = true">See plans</button>
    <button v-if="sub.phase.value === 'notice'" aria-label="Hide" class="flex size-9 items-center justify-center text-lg text-accent-300" @click="hidden = true">
      <i class="ph ph-x" />
    </button>
  </div>

  <Teleport to="body">
    <!-- After the notice period: covers the app (tab bar too) until subscribed. -->
    <div
      v-if="blocking"
      role="dialog"
      aria-labelledby="paywall-title"
      class="fixed inset-0 z-50 overflow-y-auto bg-bg"
      style="padding-top: calc(env(safe-area-inset-top) + 32px); padding-bottom: calc(env(safe-area-inset-bottom) + 24px)"
    >
      <div class="mx-auto flex max-w-xl flex-col gap-5 px-5">
        <i class="ph-fill ph-crown-simple text-[40px] text-accent-400" />
        <h1 id="paywall-title" class="text-[28px] font-medium leading-tight tracking-[-0.01em]">Keep tracking with a subscription</h1>
        <p class="text-[15px] leading-normal text-neutral-300">
          Your workouts, meals and progress are all still here, and nothing is ever deleted. Subscribe to keep logging.
        </p>
        <PaywallPlans />
        <NuxtLink to="/data" class="flex h-11 items-center justify-center gap-1.5 text-sm text-neutral-400">
          <i class="ph ph-download-simple" />Export my data
        </NuxtLink>
      </div>
    </div>

    <!-- During the notice period: the plans, dismissible. -->
    <template v-else-if="sub.sheet.value && sub.phase.value !== 'off' && sub.phase.value !== 'active'">
      <div class="fixed inset-0 z-40 bg-[color-mix(in_srgb,theme(colors.bg)_70%,transparent)]" @click="sub.sheet.value = false" />
      <div
        role="dialog"
        aria-labelledby="plans-title"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh-80px)] max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-sheet bg-surface px-5 pt-2.5 shadow-lg"
        style="padding-bottom: calc(env(safe-area-inset-bottom) + 20px)"
      >
        <span class="h-[5px] w-10 flex-none self-center rounded-sm bg-neutral-700" />
        <h2 id="plans-title" class="text-xl font-medium">
          {{ sub.phase.value === 'notice' ? `Subscriptions start in ${days}` : 'Choose a plan' }}
        </h2>
        <p class="text-[15px] leading-normal text-neutral-300">
          <template v-if="sub.phase.value === 'notice'">Everything works as usual until then. </template>Your log stays yours either way: nothing is ever deleted.
        </p>
        <PaywallPlans />
        <button class="h-[52px] flex-none rounded-md bg-neutral-900 text-base active:bg-neutral-800" @click="sub.sheet.value = false">Not now</button>
      </div>
    </template>
  </Teleport>
</template>
