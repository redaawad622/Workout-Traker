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
  app: {
    head: {
      title: 'Workout Log',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#161826' }
      ]
    }
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Workout Log',
      short_name: 'Workout',
      theme_color: '#161826',
      background_color: '#161826',
      display: 'standalone',
      icons: []
    },
    workbox: { navigateFallback: '/', globPatterns: ['**/*.{js,css,html,woff2}'] },
    devOptions: { enabled: false }
  }
})
