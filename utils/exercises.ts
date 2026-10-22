// Exercises you do one OR the other, never both on the same day.
// Logging any member hides the rest of its group for that day.
// To add a pair, add another array here.
export const ALTERNATIVE_GROUPS: string[][] = [['Leg Curl', 'Seated Leg Curl']]

export const alternativesOf = (name: string): string[] =>
  ALTERNATIVE_GROUPS.find((g) => g.includes(name))?.filter((n) => n !== name) ?? []
