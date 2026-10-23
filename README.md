# Workout Tracker

Local-first Nuxt 3 SPA/PWA (Vue 3, Pinia, Dexie/IndexedDB, Tailwind). Dark "Nocturne" theme: tokens live in `tailwind.config.ts`; Inter and Phosphor icons are bundled so it works offline.

    npm install
    npm run dev        # http://localhost:3000
    npm run build      # static output in .output/public

Seeded from the exported chat: 3 Oct baseline, 22 Oct session. The 5 Oct update has no confirmed
date, so it is stored as "unverified" and excluded from progress until you confirm it in the app.

## iPhone app (Capacitor)
The iOS project lives in `ios/` (bundle id `com.redaawad.workoutlog`).

    npm run ios          # nuxt generate + cap sync ios
    npx cap open ios     # then pick your team under Signing and press Run

The native app keeps its own storage, separate from the Safari / home-screen PWA.
Move data between them with Export backup and Import on the Data tab.

## Ask Claude (optional)
"Ask Claude" sends a ready-made question about a new food or exercise to the Claude app through
the share sheet (or copies it). Copy Claude's whole reply, come back, and tap "Paste answer": the
app reads the JSON in the reply and fills the form for you to check. No API key or server is involved.
