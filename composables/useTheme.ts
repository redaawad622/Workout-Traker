export type ThemeChoice = 'nocturne' | 'daylight' | 'system'

const KEY = 'theme'
// Status bar / browser chrome color, matching each theme's --bg.
const CHROME = { nocturne: '#161826', daylight: '#f5f5f7' }

const choice = ref<ThemeChoice>('nocturne')
let started = false

const dark = () => window.matchMedia('(prefers-color-scheme: dark)')

function apply() {
  const theme = choice.value === 'system' ? (dark().matches ? 'nocturne' : 'daylight') : choice.value
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[theme])
}

// The saved choice is applied before the app mounts by the inline script in nuxt.config.ts,
// so there is no flash; this keeps it in sync afterwards and follows iPhone Dark Mode.
export function useTheme() {
  if (!started && import.meta.client) {
    started = true
    try {
      const saved = localStorage.getItem(KEY)
      if (saved === 'daylight' || saved === 'system') choice.value = saved
    } catch {}
    dark().addEventListener('change', () => choice.value === 'system' && apply())
    watch(choice, (c) => {
      try {
        localStorage.setItem(KEY, c)
      } catch {}
      apply()
    })
    apply()
  }
  return { choice }
}
