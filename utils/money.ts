import type { MealSlot } from './nutrition'

// A meal's price can be sent to Money Tracker as an expense. Both apps share the account, so the
// expense is written straight into Money Tracker's synced table (money_records, kind "expenses")
// and shows up there on its next sync, like one added on another phone.

export const MONEY_TABLE = 'money_records'

// Money Tracker's category ids. It has no snacks category, so snacks go to Other.
export const MONEY_CATEGORY: Record<MealSlot, { id: string; name: string }> = {
  breakfast: { id: 'breakfast', name: 'Breakfast' },
  lunch: { id: 'lunch', name: 'Lunch' },
  dinner: { id: 'dinner', name: 'Dinner' },
  snack: { id: 'other-daily', name: 'Other' }
}

/** An expense as Money Tracker stores it, without its id. */
export interface MoneyExpense {
  amount: number
  categoryId: string
  note: string
  date: string // YYYY-MM-DD
  createdAt: number
}

export function mealExpense(m: { price: number; slot: MealSlot; name: string; date: string }): MoneyExpense {
  return { amount: Math.round(m.price * 100) / 100, categoryId: MONEY_CATEGORY[m.slot].id, note: m.name, date: m.date, createdAt: Date.now() }
}

export const newMoneyUid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
