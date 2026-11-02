export type MovementType = 'income' | 'expense'
export type PaymentMethod =
  | 'Efectivo'
  | 'Cuenta bancaria'
  | 'Tarjeta débito'
  | 'Tarjeta de crédito'
  | 'Transferencia'
  | 'Otros'

export interface Movement {
  id?: number
  type: MovementType
  description: string
  amount: number
  date: string
  categoryId: number
  paymentMethod: PaymentMethod
  account: string
  cardId?: number
  notes: string
  createdAt: string
}

export interface Category {
  id?: number
  name: string
  color: string
  icon: string
  parentId?: number
  kind: 'income' | 'expense' | 'both'
  isDefault?: boolean
  archived?: boolean
}

export interface CreditCard {
  id?: number
  name: string
  bank: string
  type: string
  limit?: number
  closingDay?: number
  dueDay?: number
  createdAt: string
}

export interface CardPayment {
  id?: number
  cardId: number
  amount: number
  date: string
  notes: string
  createdAt: string
}

export interface SavingsGoal {
  id?: number
  name: string
  target: number
  createdAt: string
}

export interface GoalContribution {
  id?: number
  goalId: number
  amount: number
  date: string
  notes: string
}

export interface MonthClosing {
  id?: number
  month: string
  data: ClosingData
  createdAt: string
}

export interface ClosingData {
  income: number
  expenses: number
  balance: number
  saved: number
  topCategory: string
  categoryTotals: Record<string, number>
  cardTotals: Record<string, number>
  debts: Record<string, number>
  previousMonthExpenses?: number
}

export interface AppSettings {
  id: 'preferences'
  currency: 'COP'
  theme: 'light' | 'dark'
  categoriesSeeded: boolean
}
