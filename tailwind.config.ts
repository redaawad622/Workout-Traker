import type { Config } from 'tailwindcss'

// Theme tokens. Two themes, Nocturne (dark) and Daylight (light): values live in assets/css/main.css.
export default {
  content: ['./components/**/*.vue', './pages/**/*.vue', './app.vue', './utils/**/*.ts'],
  theme: {
    extend: {
      // Every color is a CSS variable; assets/css/main.css gives each theme its values.
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        neutral: Object.fromEntries([100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, `var(--neutral-${n})`])),
        accent: {
          DEFAULT: 'var(--accent)',
          ...Object.fromEntries([100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, `var(--accent-${n})`]))
        },
        // Amber for warnings: unverified rows, destructive confirms, import errors.
        warn: {
          DEFAULT: 'var(--warn)',
          line: 'var(--warn-line)',
          border: 'var(--warn-border)',
          tint: 'var(--warn-tint)',
          text: 'var(--warn-text)'
        }
      },
      fontFamily: {
        sans: 'var(--font-sans)'
      },
      borderRadius: {
        sm: '4px',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: '20px',
        sheet: '24px'
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        hairline: '0 1px 0 var(--neutral-800)',
        'hairline-dim': '0 1px 0 var(--neutral-900)'
      },
      fontWeight: {
        // Nocturne's medium is 500; Daylight runs headings and emphasis at 600.
        medium: 'var(--weight-medium)'
      }
    }
  }
} satisfies Config
