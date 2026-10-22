export type Unit = 'lbs' | 'kg'

const LB_TO_KG = 0.453592

export const lbsToKg = (lbs: number) => lbs * LB_TO_KG
export const kgToLbs = (kg: number) => kg / LB_TO_KG
export const round1 = (n: number) => Math.round(n * 10) / 10

export function toKg(weight: number, unit: Unit) {
  return round1(unit === 'kg' ? weight : lbsToKg(weight))
}

export function toLbs(weight: number, unit: Unit) {
  return round1(unit === 'lbs' ? weight : kgToLbs(weight))
}

export function formatWeight(weight: number, unit: Unit) {
  return unit === 'lbs'
    ? `${weight} lbs ≈ ${toKg(weight, unit)} kg`
    : `${weight} kg ≈ ${toLbs(weight, unit)} lbs`
}
