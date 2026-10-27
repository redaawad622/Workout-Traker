<script setup lang="ts">
// The two plans and how to get one: sign in first (so the subscription follows you to every
// device), then pay on the plan's checkout page. Used by the notice sheet and the subscribe screen.
const sub = useSubscription()
const account = useAccount()
const c = sub.config
const providerLabel = { google: 'Google', apple: 'Apple' } as const
const saving = computed(() => Math.round((1 - c.value.yearlyPrice / (c.value.monthlyPrice * 12)) * 100))
const plans = computed(() => [
  { id: 'yearly' as const, name: 'Yearly', price: sub.price(c.value.yearlyPrice), per: 'year', url: c.value.yearlyUrl, note: saving.value > 0 ? `Save ${saving.value}%` : '' },
  { id: 'monthly' as const, name: 'Monthly', price: sub.price(c.value.monthlyPrice), per: 'month', url: c.value.monthlyUrl, note: '' }
])
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <button
      v-for="p in plans"
      :key="p.id"
      class="card flex min-h-[64px] items-center gap-3.5 px-4 text-left active:bg-neutral-900 disabled:opacity-60"
      :disabled="!account.user.value || !p.url"
      @click="sub.checkout(p.id)"
    >
      <span class="flex flex-1 flex-col">
        <span class="text-base">{{ p.name }}</span>
        <span class="text-xs text-neutral-400">{{ p.url ? `Billed every ${p.per}, cancel anytime` : 'Not available yet' }}</span>
      </span>
      <span v-if="p.note" class="chip bg-accent-900 text-accent-300">{{ p.note }}</span>
      <span class="tnum text-lg font-medium">{{ p.price }}<span class="text-sm font-normal text-neutral-400">/{{ p.per }}</span></span>
    </button>

    <template v-if="!account.user.value">
      <p class="pt-1 text-sm leading-normal text-neutral-300">Sign in first, so your subscription works on all your devices.</p>
      <button
        v-for="p in account.providers.value"
        :key="p"
        class="btn-outline min-h-[52px] text-base disabled:opacity-60"
        :disabled="account.busy.value"
        @click="account.signIn(p)"
      >
        <i class="text-xl" :class="p === 'apple' ? 'ph-fill ph-apple-logo' : 'ph-bold ph-google-logo'" />Continue with {{ providerLabel[p] }}
      </button>
      <p v-if="account.error.value" role="alert" class="text-sm text-warn-text">{{ account.error.value }}</p>
    </template>
    <button
      v-else
      class="flex h-11 items-center justify-center gap-1.5 text-sm text-neutral-300 disabled:opacity-60"
      :disabled="sub.checking.value"
      @click="sub.checkPaid()"
    >
      <i class="ph ph-arrows-clockwise" :class="{ 'animate-spin': sub.checking.value }" />Already subscribed? Check again
    </button>
  </div>
</template>
