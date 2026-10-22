# Workout Log

Local-first Nuxt 3 SPA/PWA (Vue 3, Pinia, Dexie/IndexedDB, Tailwind, Chart.js).

    npm install
    npm run dev        # http://localhost:3000
    npm run build      # static output in .output/public

Seeded from the exported chat: 3 Oct baseline, 22 Oct session. The 5 Oct update has no confirmed
date, so it is stored as "unverified" and excluded from progress until you confirm it in the app.

## Mobile later (Capacitor)
    npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
    npx cap init "Workout Log" com.reda.workoutlog --web-dir=.output/public
    npm run build && npx cap add ios && npx cap sync
