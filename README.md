# Workout Tracker

Local-first Nuxt 3 SPA/PWA (Vue 3, Pinia, Dexie/IndexedDB, Tailwind). Dark "Nocturne" theme: tokens live in `tailwind.config.ts`; Inter and Phosphor icons are bundled so it works offline.

    npm install
    npm run dev        # http://localhost:3000
    npm run build      # Vercel build: static pages + the Ask Claude function
    npm run generate   # fully static output in .output/public

Seeded from the exported chat: 3 Oct baseline, 22 Oct session. The 5 Oct update has no confirmed
date, so it is stored as "unverified" and excluded from progress until you confirm it in the app.

## iPhone app (Capacitor)
The iOS project lives in `ios/` (bundle id `com.redaawad.workoutlog`).

    npm run ios          # nuxt generate + cap sync ios
    npx cap open ios     # then pick your team under Signing and press Run

The native app keeps its own storage, separate from the Safari / home-screen PWA.
Move data between them with Export backup and Import on the Data tab.

## Ask Claude (optional)
"Ask Claude" fills in a new food's nutrition or a new exercise's details (split day, muscles,
per-dumbbell) for you to check before saving. Manual entry still works offline without it.

It runs through `server/api/ai/fill.ts`, a Vercel function, so the API key never ships in the app.
In Vercel → Project → Settings → Environment Variables, add:

- `ANTHROPIC_API_KEY`: a key from console.anthropic.com (an API key, not a claude.ai subscription)
- `AI_PASSCODE`: any phrase you choose; enter the same one in the app under Reports → Backup → Ask Claude

`npm run build` is `nuxt build` (static pages plus the function); `npm run ios` stays fully static
and the iPhone app calls https://workout-traker.vercel.app for Claude.
