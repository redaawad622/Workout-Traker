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
      name: 'Workout Log',
      short_name: 'Workout',
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
