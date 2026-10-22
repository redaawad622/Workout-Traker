// Exercises you do one OR the other, never both on the same day.
// Logging any member hides the rest of its group for that day.
// To add a pair, add another array here.
export const ALTERNATIVE_GROUPS: string[][] = [['Leg Curl', 'Seated Leg Curl']]

export const alternativesOf = (name: string): string[] =>
  ALTERNATIVE_GROUPS.find((g) => g.includes(name))?.filter((n) => n !== name) ?? []

// Push / pull / legs split. Starting lists only: a brand-new exercise logged on a
// split day is added to that day's list (saved on the phone in the meta table).
export type SplitDay = 'push' | 'pull' | 'legs'
export type DayType = 'full' | SplitDay

export const SPLIT_DAYS: SplitDay[] = ['push', 'pull', 'legs']

export const DAY_LABELS: Record<DayType, string> = { full: 'Full body', push: 'Push', pull: 'Pull', legs: 'Legs' }

export const DEFAULT_SPLIT: Record<SplitDay, string[]> = {
  push: [
    'Chest Press Machine',
    'Incline Press Machine',
    'Pec Deck Fly',
    'Shoulder Press Machine',
    'Lateral Raise — Dumbbells',
    'Triceps Rope Pushdown',
    'Overhead Triceps Extension — Cable'
  ],
  pull: [
    'Lat Pulldown',
    'Low Row — Narrow Grip',
    'Seated Cable Row — Wide Grip',
    'Face Pull',
    'Rear Delt Fly — Machine',
    'Cable Biceps Curl',
    'Hammer Curl — Dumbbells'
  ],
  legs: [
    'Leg Press',
    'Romanian Deadlift — Dumbbells',
    'Leg Extension',
    'Leg Curl',
    'Seated Leg Curl',
    'Hip Thrust Machine',
    'Calf Raise'
  ]
}

// Group a list of exercises into training slots: alternatives (either/or) share one slot.
export function slotsOf(list: string[]): string[][] {
  const slots: string[][] = []
  for (const name of list) {
    const group = ALTERNATIVE_GROUPS.find((g) => g.includes(name))
    const existing = group && slots.find((s) => group.includes(s[0]))
    if (existing) existing.push(name)
    else slots.push([name])
  }
  return slots
}
