// How long each muscle takes to recover after training it, and how far along it is now.
import type { Entry } from './db'
import type { AiExercise } from './ai'

export type Muscle =
  | 'chest'
  | 'back'
  | 'frontDelt'
  | 'sideDelt'
  | 'rearDelt'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'traps'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'lowerBack'

// Hours to fully recover, in the order muscles are listed.
export const RECOVERY_HOURS: Record<Muscle, number> = {
  chest: 36,
  back: 48,
  frontDelt: 36,
  sideDelt: 36,
  rearDelt: 48,
  biceps: 36,
  triceps: 36,
  forearms: 24,
  traps: 48,
  abs: 24,
  quads: 48,
  hamstrings: 48,
  glutes: 48,
  calves: 36,
  lowerBack: 48
}

export const MUSCLES = Object.keys(RECOVERY_HOURS) as Muscle[]

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest',
  back: 'Back',
  frontDelt: 'Front delts',
  sideDelt: 'Side delts',
  rearDelt: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  traps: 'Traps',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  lowerBack: 'Lower back'
}

// Muscles each built-in exercise works hard enough to need recovery, main one first.
const EXERCISE_MUSCLES: Record<string, Muscle[]> = {
  'Chest Press Machine': ['chest', 'frontDelt', 'triceps'],
  'Incline Press Machine': ['chest', 'frontDelt', 'triceps'],
  'Pec Deck Fly': ['chest'],
  'Shoulder Press Machine': ['frontDelt', 'sideDelt', 'triceps'],
  'Lateral Raise — Dumbbells': ['sideDelt'],
  'Triceps Rope Pushdown': ['triceps'],
  'Overhead Triceps Extension — Cable': ['triceps'],
  'Lat Pulldown': ['back', 'biceps'],
  'Low Row — Narrow Grip': ['back', 'biceps', 'rearDelt'],
  'Seated Cable Row — Wide Grip': ['back', 'rearDelt', 'traps'],
  'Face Pull': ['rearDelt', 'traps'],
  'Rear Delt Fly — Machine': ['rearDelt'],
  'Cable Biceps Curl': ['biceps'],
  'Biceps Curl — Dumbbells': ['biceps'],
  'Hammer Curl — Dumbbells': ['biceps', 'forearms'],
  'Hammer Curl — Cable Rope': ['biceps', 'forearms'],
  'Leg Press': ['quads', 'glutes'],
  'Smith Machine Squat': ['quads', 'glutes'],
  'Goblet Squat — Dumbbells': ['quads', 'glutes'],
  'Romanian Deadlift — Dumbbells': ['hamstrings', 'glutes', 'lowerBack'],
  'Romanian Deadlift — Barbell': ['hamstrings', 'glutes', 'lowerBack'],
  'Leg Extension': ['quads'],
  'Leg Curl': ['hamstrings'],
  'Seated Leg Curl': ['hamstrings'],
  'Hip Thrust Machine': ['glutes', 'hamstrings'],
  'Smith Machine Hip Thrust': ['glutes', 'hamstrings'],
  'Hip Abductor Machine': ['glutes'],
  'Hip Adductor Machine': [],
  'Calf Raise': ['calves']
}

// For exercises not in the list above: words in the name (or in the muscles an AI app gave).
const KEYWORDS: [RegExp, Muscle[]][] = [
  [/rear delt|reverse fly|face pull/i, ['rearDelt']],
  [/lateral raise|side delt|upright row/i, ['sideDelt']],
  [/shoulder press|overhead press|military|arnold|front raise|front delt|anterior delt/i, ['frontDelt']],
  [/\bdelts?\b|shoulder/i, ['frontDelt', 'sideDelt']],
  [/chest|pec|bench|push-?up|\bdips?\b|\bfly\b|flye|crossover/i, ['chest']],
  [/triceps|pushdown|skull ?crusher|kickback/i, ['triceps']],
  [/biceps|\bcurl\b|preacher/i, ['biceps']],
  [/forearm|wrist|grip|hammer/i, ['forearms']],
  [/\btraps?\b|trapezius|shrug/i, ['traps']],
  [/lower back|erector|back extension|hyperextension|good morning|deadlift/i, ['lowerBack']],
  [/\blats?\b|latissimus|pulldown|pull-?up|chin-?up|\brow\b|rhomboid|\bback\b/i, ['back']],
  [/\babs?\b|abdominal|core|crunch|plank|oblique|leg raise|sit-?up/i, ['abs']],
  [/hamstring|leg curl|romanian|\brdl\b|nordic/i, ['hamstrings']],
  [/glute|hip thrust|bridge|abductor/i, ['glutes']],
  [/quad|squat|leg press|leg extension|lunge|split squat|step-?up|hack/i, ['quads']],
  [/calf|calves|soleus|gastrocnemius/i, ['calves']]
]

// Muscles an exercise works. Built-in exercises use the list above; others are guessed from
// their name and, when an AI app filled them in, the muscles it named.
export function musclesOf(exercise: string, info?: AiExercise): Muscle[] {
  const known = EXERCISE_MUSCLES[exercise]
  if (known) return known
  const text = [exercise, ...(info?.muscles ?? [])].join(' · ')
  const out: Muscle[] = []
  for (const [re, muscles] of KEYWORDS) if (re.test(text)) muscles.forEach((m) => out.includes(m) || out.push(m))
  return out
}

// Hour of the day assumed for entries logged before the time was saved with them.
const ASSUMED_HOUR = 18

// When an entry was logged: its saved time, else the assumed hour of its date.
export function loggedAt(e: Pick<Entry, 'date' | 'at'>): number {
  if (e.at) return new Date(e.at).getTime()
  const [y, m, d] = e.date.split('-').map(Number)
  return new Date(y, m - 1, d, ASSUMED_HOUR).getTime()
}

export interface Recovery {
  muscle: Muscle
  pct: number // 0–100
  hoursLeft: number // 0 when recovered
  last?: Entry // latest entry that worked it
}

// Recovery of each muscle at time `now`, from the latest entry that worked it.
// Muscles never trained are 100%.
export function recoveryOf(
  muscles: Muscle[],
  entries: Entry[],
  now: number,
  infoOf: (exercise: string) => AiExercise | undefined = () => undefined
): Recovery[] {
  const latest = new Map<Muscle, { e: Entry; at: number }>()
  for (const e of entries) {
    const at = loggedAt(e)
    if (at > now) continue
    for (const m of musclesOf(e.exercise, infoOf(e.exercise))) {
      const prev = latest.get(m)
      if (!prev || at > prev.at) latest.set(m, { e, at })
    }
  }
  return muscles.map((muscle) => {
    const hit = latest.get(muscle)
    if (!hit) return { muscle, pct: 100, hoursLeft: 0 }
    const hours = RECOVERY_HOURS[muscle]
    const since = (now - hit.at) / 3600000
    return {
      muscle,
      pct: Math.max(0, Math.min(100, Math.floor((since / hours) * 100))),
      hoursLeft: Math.max(0, Math.ceil(hours - since)),
      last: hit.e
    }
  })
}

// Muscles a list of exercises works, in the order of MUSCLES.
export function musclesOfList(exercises: string[], infoOf: (exercise: string) => AiExercise | undefined = () => undefined): Muscle[] {
  const set = new Set(exercises.flatMap((n) => musclesOf(n, infoOf(n))))
  return MUSCLES.filter((m) => set.has(m))
}
