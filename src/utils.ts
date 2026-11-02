import type { Category, CreditCard, Movement, PaymentMethod } from './types'

export const DEFAULT_METHODS: PaymentMethod[] = [
  'Efectivo', 'Cuenta bancaria', 'Tarjeta débito',
  'Tarjeta de crédito', 'Transferencia', 'Otros'
]

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0)

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(`${date}T12:00:00-05:00`))

export const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

export const monthKey = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit'
  }).format(date)

export const shiftMonth = (month: string, delta: number) => {
  const [year, value] = month.split('-').map(Number)
  return monthKey(new Date(year, value - 1 + delta, 1, 12))
}

export const monthName = (month: string) =>
  new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota'
  }).format(new Date(`${month}-15T12:00:00-05:00`))

export function calcCardDebt(cardId: number, movements: Movement[], payments: { cardId: number; amount: number }[]) {
  const purchases = movements
    .filter(item => item.cardId === cardId && item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0)
  const paid = payments.filter(item => item.cardId === cardId).reduce((sum, item) => sum + item.amount, 0)
  return Math.max(0, purchases - paid)
}

export function categoryLabel(id: number, categories: Category[]) {
  return categories.find(item => item.id === id)?.name ?? 'Categoría eliminada'
}

export function cardLabel(id: number | undefined, cards: CreditCard[]) {
  return cards.find(item => item.id === id)?.name ?? 'Sin tarjeta'
}

export function validateImport(data: unknown): data is {
  version: number
  movements: Movement[]
  categories: Category[]
  cards: CreditCard[]
  cardPayments: { id?: number; cardId: number; amount: number; date: string; notes: string; createdAt: string }[]
  goals: { id?: number; name: string; target: number; createdAt: string }[]
  contributions: { id?: number; goalId: number; amount: number; date: string; notes: string }[]
  closings: import('./types').MonthClosing[]
} {
  if (!data || typeof data !== 'object') return false
  const backup = data as Record<string, unknown>
  const arrays = ['movements', 'categories', 'cards', 'cardPayments', 'goals', 'contributions', 'closings']
  if (backup.version !== 1 || !arrays.every(key => Array.isArray(backup[key]))) return false

  const rows = (key: string) => backup[key] as Record<string, unknown>[]
  const validId = (id: unknown) => id === undefined || (typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
  const validDate = (date: unknown) => typeof date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(`${date}T12:00:00Z`))
    && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
  const validAmount = (amount: unknown) => typeof amount === 'number' && Number.isFinite(amount) && amount > 0
  const methods: string[] = DEFAULT_METHODS

  if (!rows('movements').every(item =>
    item && typeof item === 'object'
    && validId(item.id)
    && (item.type === 'income' || item.type === 'expense')
    && typeof item.description === 'string' && item.description.trim().length > 0 && item.description.length <= 100
    && validAmount(item.amount)
    && validDate(item.date)
    && typeof item.categoryId === 'number' && Number.isSafeInteger(item.categoryId) && item.categoryId > 0
    && methods.includes(String(item.paymentMethod))
    && typeof item.account === 'string'
    && typeof item.notes === 'string'
    && (item.cardId === undefined || (typeof item.cardId === 'number' && Number.isSafeInteger(item.cardId) && item.cardId > 0))
    && typeof item.createdAt === 'string'
  )) return false

  if (!rows('categories').every(item =>
    item && typeof item === 'object'
    && validId(item.id)
    && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 40
    && typeof item.color === 'string' && /^#[\da-f]{6}$/i.test(item.color)
    && typeof item.icon === 'string' && item.icon.length <= 8
    && ['income', 'expense', 'both'].includes(String(item.kind))
    && (item.parentId === undefined || (typeof item.parentId === 'number' && Number.isSafeInteger(item.parentId) && item.parentId > 0))
    && (item.archived === undefined || typeof item.archived === 'boolean')
  )) return false

  if (!rows('cards').every(item =>
    item && typeof item === 'object'
    && validId(item.id)
    && typeof item.name === 'string' && item.name.trim().length > 0
    && typeof item.bank === 'string' && item.bank.trim().length > 0
    && typeof item.type === 'string'
    && (item.limit === undefined || (typeof item.limit === 'number' && Number.isFinite(item.limit) && item.limit > 0))
    && (item.closingDay === undefined || (typeof item.closingDay === 'number' && Number.isInteger(item.closingDay) && item.closingDay >= 1 && item.closingDay <= 31))
    && (item.dueDay === undefined || (typeof item.dueDay === 'number' && Number.isInteger(item.dueDay) && item.dueDay >= 1 && item.dueDay <= 31))
    && typeof item.createdAt === 'string'
  )) return false

  if (!rows('cardPayments').every(item =>
    item && typeof item === 'object'
    && validId(item.id)
    && typeof item.cardId === 'number' && Number.isSafeInteger(item.cardId) && item.cardId > 0
    && validAmount(item.amount) && validDate(item.date)
    && typeof item.notes === 'string' && typeof item.createdAt === 'string'
  )) return false

  if (!rows('goals').every(item =>
    item && typeof item === 'object'
    && validId(item.id)
    && typeof item.name === 'string' && item.name.trim().length > 0
    && validAmount(item.target)
    && typeof item.createdAt === 'string'
  )) return false

  if (!rows('contributions').every(item =>
    item && typeof item === 'object'
    && validId(item.id)
    && typeof item.goalId === 'number' && Number.isSafeInteger(item.goalId) && item.goalId > 0
    && validAmount(item.amount) && validDate(item.date)
    && typeof item.notes === 'string'
  )) return false

  const validClosings = rows('closings').every(item => {
    if (!item || typeof item !== 'object' || !validId(item.id)
      || typeof item.month !== 'string' || !/^\d{4}-\d{2}$/.test(item.month)
      || !item.data || typeof item.data !== 'object') return false
    const snapshot = item.data as Record<string, unknown>
    const numericMaps = ['categoryTotals', 'cardTotals', 'debts'].every(key =>
      !!snapshot[key] && typeof snapshot[key] === 'object'
      && Object.values(snapshot[key] as Record<string, unknown>).every(value => typeof value === 'number' && Number.isFinite(value))
    )
    return numericMaps
      && ['income', 'expenses', 'balance', 'saved', 'previousMonthExpenses'].every(key =>
      snapshot[key] === undefined || (typeof snapshot[key] === 'number' && Number.isFinite(snapshot[key]))
    ) && typeof snapshot.topCategory === 'string'
      && typeof item.createdAt === 'string'
  })
  if (!validClosings) return false

  const categoryIds = new Set(rows('categories').map(item => item.id).filter((id): id is number => typeof id === 'number'))
  const cardIds = new Set(rows('cards').map(item => item.id).filter((id): id is number => typeof id === 'number'))
  const goalIds = new Set(rows('goals').map(item => item.id).filter((id): id is number => typeof id === 'number'))
  if (rows('categories').some(item => item.parentId !== undefined && !categoryIds.has(Number(item.parentId)))) return false
  if (rows('movements').some(item =>
    !categoryIds.has(Number(item.categoryId))
    || (item.cardId !== undefined && (!cardIds.has(Number(item.cardId)) || item.paymentMethod !== 'Tarjeta de crédito' || item.type !== 'expense'))
    || (item.paymentMethod === 'Tarjeta de crédito' && item.cardId === undefined)
  )) return false
  if (rows('cardPayments').some(item => !cardIds.has(Number(item.cardId)))) return false
  if (rows('contributions').some(item => !goalIds.has(Number(item.goalId)))) return false
  return true
}
