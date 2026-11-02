import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings,
  CardPayment,
  Category,
  CreditCard,
  GoalContribution,
  MonthClosing,
  Movement,
  SavingsGoal
} from './types'

class FinanceDatabase extends Dexie {
  movements!: EntityTable<Movement, 'id'>
  categories!: EntityTable<Category, 'id'>
  cards!: EntityTable<CreditCard, 'id'>
  cardPayments!: EntityTable<CardPayment, 'id'>
  goals!: EntityTable<SavingsGoal, 'id'>
  contributions!: EntityTable<GoalContribution, 'id'>
  closings!: EntityTable<MonthClosing, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('vanesa-finanzas-local')
    this.version(1).stores({
      movements: '++id, type, date, categoryId, cardId, paymentMethod',
      categories: '++id, name, parentId, kind',
      cards: '++id, name, bank',
      cardPayments: '++id, cardId, date',
      goals: '++id, name',
      contributions: '++id, goalId, date',
      closings: '++id, &month',
      settings: '&id'
    })
  }
}

export const db = new FinanceDatabase()

const initialCategories: Omit<Category, 'id'>[] = [
  ['Alimentación', '#4b8f71', '🍎'], ['Restaurantes', '#df8c4a', '🍽️'],
  ['Domicilios', '#db7068', '🛵'], ['Transporte', '#5487bf', '🚌'],
  ['Gasolina', '#9c78c5', '⛽'], ['Vivienda', '#6b88a5', '🏠'],
  ['Arriendo', '#6683a5', '🔑'], ['Servicios públicos', '#e3b54a', '💡'],
  ['Salud', '#d46979', '💊'], ['Compras personales', '#a16ca4', '🛍️'],
  ['Entretenimiento', '#8570c5', '🎬'], ['Educación', '#538a94', '📚'],
  ['Suscripciones', '#7185af', '📱'], ['Viajes', '#469b9b', '✈️'],
  ['Deudas', '#ba6b58', '💳'], ['Ahorros', '#4c9a76', '🐷'],
  ['Otros', '#89938f', '✦']
].map(([name, color, icon]) => ({
  name: String(name),
  color: String(color),
  icon: String(icon),
  kind: 'expense' as const,
  isDefault: true
}))

export async function initializeDatabase() {
  await db.transaction('rw', db.categories, db.cards, db.settings, async () => {
    const settings = await db.settings.get('preferences')
    if (!settings) {
      await db.settings.put({
        id: 'preferences',
        currency: 'COP',
        theme: 'light',
        categoriesSeeded: true
      })
    }

    if (await db.categories.count() === 0) {
      await db.categories.bulkAdd(initialCategories)
      await db.categories.add({
        name: 'Ingresos',
        color: '#288b62',
        icon: '💰',
        kind: 'income',
        isDefault: true
      })
    }

    if (await db.cards.count() === 0) {
      const createdAt = new Date().toISOString()
      await db.cards.bulkAdd([
        { name: 'Nu', bank: 'Nu Colombia', type: 'Crédito', createdAt },
        { name: 'American Express', bank: 'American Express', type: 'Crédito', createdAt }
      ])
    }
  })
}
