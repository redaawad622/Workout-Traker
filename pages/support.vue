<script setup lang="ts">
import { CONTACT_EMAIL } from '~/utils/legal'

useHead({ title: 'Support · Workout Tracker' })
</script>

<template>
  <article class="flex flex-col gap-4 pb-6 text-[15px] leading-relaxed text-neutral-300">
    <div class="flex items-center gap-1">
      <NuxtLink to="/data" aria-label="Back" class="-ml-2.5 flex size-11 items-center justify-center text-[22px] text-neutral-300">
        <i class="ph ph-caret-left" />
      </NuxtLink>
      <h1 class="text-[28px] font-medium tracking-[-0.01em] text-ink">Support</h1>
    </div>

    <p v-if="CONTACT_EMAIL">Questions, bugs or ideas: email <a :href="`mailto:${CONTACT_EMAIL}`" class="text-accent-400 underline">{{ CONTACT_EMAIL }}</a>.</p>

    <h2 class="label mt-2">Keep your log safe</h2>
    <p>Your log lives on your phone. Export a JSON backup from Reports → Backup now and then, or sign in there to sync it to your account. Updating the app never deletes your log.</p>

    <h2 class="label mt-2">Move to a new phone</h2>
    <p>Sign in with the same account on the new phone, or export a JSON backup on the old one and import it on the new one.</p>

    <h2 class="label mt-2">Delete your account</h2>
    <p>Reports → Backup → Delete account. See the <NuxtLink to="/privacy" class="text-accent-400 underline">privacy policy</NuxtLink> for what is stored.</p>
  </article>
</template>
