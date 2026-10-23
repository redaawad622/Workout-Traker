// Exercises you do one OR the other, never both on the same day.
// Logging any member hides the rest of its group for that day.
// To add a pair, add another array here.
export const ALTERNATIVE_GROUPS: string[][] = [['Leg Curl', 'Seated Leg Curl']]

export const alternativesOf = (name: string): string[] =>
  ALTERNATIVE_GROUPS.find((g) => g.includes(name))?.filter((n) => n !== name) ?? []

// Push / pull / legs split. Starting lists only: a brand-new exercise logged on a
// split day is added to that day's list (saved on the phone in the meta table).
export type SplitDay = 'push' | 'pull' | 'legs'

// Kind of day a date was trained as (meta key "day:<date>"): 'full' or a split day for the
// built-in programs, '<programId>/<dayId>' for a day of a program you made.
export type DayType = string

export const SPLIT_DAYS: SplitDay[] = ['push', 'pull', 'legs']

export const DAY_LABELS: Record<'full' | SplitDay, string> = { full: 'Full body', push: 'Push', pull: 'Pull', legs: 'Legs' }

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

// Workout programs. Full body and Push / Pull / Legs are built in; your own are saved on the
// phone (meta key "programs"). A program or day that past dates point to is only hidden when
// deleted (deleted: true), so those dates keep their day type.
export interface ProgramDay {
  id: string
  name: string
  exercises: string[]
  deleted?: boolean
}

export interface Program {
  id: string
  name: string
  days: ProgramDay[]
  deleted?: boolean
}

export const FULL_BODY = 'full'
export const PPL = 'ppl'
export const isBuiltIn = (programId: string) => programId === FULL_BODY || programId === PPL

export const programOfDay = (type: DayType): string =>
  type === 'full' ? FULL_BODY : (SPLIT_DAYS as string[]).includes(type) ? PPL : type.split('/')[0]

export const dayKey = (programId: string, dayId: string): DayType => (isBuiltIn(programId) ? dayId : `${programId}/${dayId}`)

export const newId = () => Math.random().toString(36).slice(2, 10)
