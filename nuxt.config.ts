export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: false, // pure SPA: static output, Capacitor-friendly
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vite-pwa/nuxt'],
  // Fonts and icons are bundled (not CDN) so the app keeps working offline.
  css: [
    '@fontsource/inter/400.css',
    '@fontsource/inter/500.css',
    '@fontsource/inter/600.css',
    '@phosphor-icons/web/regular',
    '@phosphor-icons/web/fill',
    '@phosphor-icons/web/bold',
    '~/assets/css/main.css'
  ],
  tailwindcss: { cssPath: false },
  // Optional accounts (Supabase). The publishable key is meant to ship in the app; row-level
  // security keeps each person to their own rows. Override with NUXT_PUBLIC_SUPABASE_URL /
  // NUXT_PUBLIC_SUPABASE_KEY at build time, or set the URL to '' to turn accounts off.
  runtimeConfig: {
    public: {
      supabaseUrl: 'https://lgbtzvvgaemlpnuktssx.supabase.co',
      supabaseKey: 'sb_publishable_yatAKSTGeF_d9I0CoTyB_g_iAgC8FMf'
    }
  },
  app: {
    head: {
      title: 'Workout Tracker',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#161826' }
      ],
      // Apply the saved theme before first paint (see composables/useTheme.ts).
      script: [
        {
          innerHTML:
            "try{var t=localStorage.getItem('theme');if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'nocturne':'daylight';if(t==='daylight')document.documentElement.dataset.theme=t}catch(e){}"
        }
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' }
      ]
    }
  },
  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
    manifest: {
      name: 'Workout Tracker',
      short_name: 'Workout Tracker',
      theme_color: '#161826',
      background_color: '#161826',
      display: 'standalone',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: { navigateFallback: '/', globPatterns: ['**/*.{js,css,html,woff2}'] },
    devOptions: { enabled: false }
  }
})
