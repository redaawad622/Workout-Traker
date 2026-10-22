import type { Entry } from './db'

// Seed data taken from the exported conversation (see workout_log_full_chat_export).
const A = (exercise: string, weight: number, unit: 'lbs' | 'kg', extra: Partial<Entry> = {}): Entry => ({
  date: '2026-10-03',
  exercise,
  weight,
  unit,
  bodyWeightKg: 86.5,
  source: 'assessment',
  note: 'Initial full-body assessment',
  ...extra
})

export const SEED_ENTRIES: Entry[] = [
  A('Lat Pulldown', 145, 'lbs'),
  A('Low Row — Narrow Grip', 145, 'lbs'),
  A('Chest Press Machine', 170, 'lbs'),
  A('Incline Press Machine', 170, 'lbs'),
  A('Shoulder Press Machine', 130, 'lbs'),
  A('Leg Extension', 170, 'lbs'),
  A('Leg Curl', 90, 'lbs'),
  A('Lateral Raise — Dumbbells', 12.5, 'kg', { perDumbbell: true }),
  A('Cable Biceps Curl', 120, 'lbs'),
  A('Triceps Rope Pushdown', 120, 'lbs'),

  // 22 Oct 2026 session (confirmed)
  { date: '2026-10-22', exercise: 'Lat Pulldown', weight: 160, unit: 'lbs', sets: 3, reps: 10, bodyWeightKg: 86.5, source: 'logged' },
  { date: '2026-10-22', exercise: 'Low Row — Narrow Grip', weight: 160, unit: 'lbs', sets: 3, reps: 10, bodyWeightKg: 86.5, source: 'logged' },

  // Earlier "later update" whose full session record was not confirmed. Kept separate, excluded from progress.
  ...[
    ['Lat Pulldown', 160],
    ['Chest Press Machine', 190],
    ['Incline Press Machine', 190],
    ['Leg Extension', 190],
    ['Leg Curl', 110]
  ].map(([exercise, weight]): Entry => ({
    date: '2026-10-05',
    exercise: exercise as string,
    weight: weight as number,
    unit: 'lbs',
    bodyWeightKg: 87,
    source: 'unverified',
    note: 'Date/session unconfirmed. Verify before trusting.'
  }))
]

export const EXERCISES = Array.from(new Set(SEED_ENTRIES.map((e) => e.exercise)))
