<script setup lang="ts">
import { CONTACT_EMAIL, POLICY_UPDATED } from '~/utils/legal'

useHead({ title: 'Privacy policy · Workout Tracker' })
</script>

<template>
  <article class="flex flex-col gap-4 pb-6 text-[15px] leading-relaxed text-neutral-300">
    <div class="flex items-center gap-1">
      <NuxtLink to="/data" aria-label="Back" class="-ml-2.5 flex size-11 items-center justify-center text-[22px] text-neutral-300">
        <i class="ph ph-caret-left" />
      </NuxtLink>
      <h1 class="text-[28px] font-medium tracking-[-0.01em] text-ink">Privacy policy</h1>
    </div>
    <p class="text-sm text-neutral-500">Last updated {{ POLICY_UPDATED }}</p>

    <p>Workout Tracker is a workout and diet log. It is built to keep your data on your phone, and it has no ads, no analytics and no tracking.</p>

    <h2 class="label mt-2">Without an account</h2>
    <p>Everything you log (workouts, meals, foods, body weight, programs and settings) is stored only on your device. Nothing is sent to us. Deleting the app deletes this data, so export a backup from Account &amp; data if you want to keep it.</p>

    <h2 class="label mt-2">With an optional account</h2>
    <p>If you choose to sign in with Apple or Google, we receive your email address and an account ID from that provider. Your log is then copied to our database so it can sync between your devices. It is used only for that, is never sold or shared for advertising, and is kept until you delete it.</p>
    <p>The database is hosted by Supabase (in the EU). Each account can only read its own data. The same account also works with Money Tracker and Azkar Tracker, made by the same developer; meal prices you send to Money Tracker go to that app's data on your account.</p>

    <h2 class="label mt-2">Ask AI</h2>
    <p>"Ask AI" opens your phone's share sheet with a summary of the days you picked. It is only sent to the app you choose, and that app's own privacy policy applies.</p>

    <h2 class="label mt-2">Deleting your data</h2>
    <p>Signed in, open Reports → Backup → Delete account. This deletes your account and everything synced to it, right away. Data on your phone stays until you delete the app.</p>

    <h2 class="label mt-2">Children</h2>
    <p>The app is not directed at children under 13.</p>

    <h2 class="label mt-2">Contact</h2>
    <p v-if="CONTACT_EMAIL">Questions about privacy: <a :href="`mailto:${CONTACT_EMAIL}`" class="text-accent-400 underline">{{ CONTACT_EMAIL }}</a></p>
    <p v-else>See the <NuxtLink to="/support" class="text-accent-400 underline">Support</NuxtLink> page.</p>
  </article>
</template>
