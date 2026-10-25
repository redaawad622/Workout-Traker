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

## Ask AI (optional)
"Ask AI" sends a ready-made question about a new food or exercise to whichever AI app you use
(Claude, ChatGPT, Gemini…) through the share sheet, and copies it too. Copy the AI's whole reply,
come back, and tap "Paste answer": the app reads the JSON in the reply and fills the form for you to
check. "Share day with AI" on Reports sends a day's workouts and meals the same way. No API key or server.

## Account and sync (optional)
On Data (Reports → Backup) you can sign in with Google or Apple to back up and sync your log
between devices, for example the iPhone app and the web app. Without an account nothing changes:
data stays on the device. Sign-in uses Supabase (project `workout-traker`, settings in
`nuxt.config.ts` → `runtimeConfig.public`), and only the providers turned on in the Supabase
dashboard are shown.

How sync works (`utils/sync.ts`): every workout entry, meal, custom food and setting is one row in
the `records` table (`supabase/migrations/`), readable only by its owner. Each sync merges both
ways. A record is deleted on a device only when you deleted it on another device; a record missing
from the cloud is uploaded again. If both sides edited the same entry, both versions are kept.
Signing out or importing a backup never deletes anything; the next sign-in merges.

The iPhone app opens sign-in in Safari's sheet and gets the result back on
`com.redaawad.workoutlog://auth-callback`.
