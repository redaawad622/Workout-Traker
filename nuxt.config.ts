export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: false, // pure SPA: static output, Capacitor-friendly
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vite-pwa/nuxt'],
  app: {
    head: {
      title: 'Workout Log',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0f172a' }
      ]
    }
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Workout Log',
      short_name: 'Workout',
      theme_color: '#0f172a',
      background_color: '#0f172a',
      display: 'standalone',
      icons: []
    },
    workbox: { navigateFallback: '/' },
    devOptions: { enabled: false }
  }
})
