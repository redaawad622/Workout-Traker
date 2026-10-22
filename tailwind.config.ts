import type { Config } from 'tailwindcss'

// Nocturne design tokens (see the Claude Design handoff). Dark only.
export default {
  content: ['./components/**/*.vue', './pages/**/*.vue', './app.vue', './utils/**/*.ts'],
  theme: {
    extend: {
      colors: {
        bg: '#161826',
        surface: '#232532',
        ink: '#e9e9ed',
        neutral: {
          100: '#f3f5fe',
          200: '#e4e7f5',
          300: '#cfd3e5',
          400: '#b2b6ca',
          500: '#9397ab',
          600: '#75798c',
          700: '#595d6c',
          800: '#3f424d',
          900: '#292b31'
        },
        accent: {
          DEFAULT: '#9184d9',
          100: '#f5f4ff',
          200: '#e7e5fe',
          300: '#d2cefd',
          400: '#b5abfc',
          500: '#968ae0',
          600: '#796cbf',
          700: '#5d5294',
          800: '#423a6a',
          900: '#2b2741'
        },
        // Amber for warnings: unverified rows, destructive confirms, import errors.
        warn: {
          DEFAULT: 'oklch(0.80 0.12 78)',
          line: 'oklch(0.72 0.12 78)',
          border: 'oklch(0.45 0.07 78)',
          tint: 'oklch(0.25 0.035 78)',
          text: 'oklch(0.88 0.08 82)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '14px',
        xl: '20px',
        sheet: '24px'
      },
      boxShadow: {
        // On a dark ground elevation is a hairline edge plus ambient darkness.
        sm: '0 0 0 1px #3f424d',
        md: '0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,0.55)',
        lg: '0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,0.65)',
        hairline: '0 1px 0 #3f424d',
        'hairline-dim': '0 1px 0 #292b31'
      }
    }
  }
} satisfies Config
