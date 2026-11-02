import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts'
import { db } from '../db'
import { calcCardDebt, categoryLabel, formatMoney, monthKey, shiftMonth } from '../utils'

type Preset = 'month' | 'previous' | 'three' | 'six' | 'year' | 'custom'
const COLORS = ['#36785d', '#a881ce', '#dc9457', '#5484a5', '#d46979', '#9caa61', '#6c71b8', '#4b9c9b']

export default function AnalyticsPage() {
  const movements = useLiveQuery(() => db.movements.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.cardPayments.toArray(), []) ?? []
  const todayMonth = monthKey()
  const [preset, setPreset] = useState<Preset>('month')
  const [from, setFrom] = useState(`${todayMonth}-01`)
  const [to, setTo] = useState(`${todayMonth}-${String(new Date().getDate()).padStart(2, '0')}`)
  const range = useMemo(() => {
    if (preset === 'custom') return { from, to }
    if (preset === 'month') return { from: `${todayMonth}-01`, to: `${todayMonth}-31` }
    if (preset === 'previous') {
      const month = shiftMonth(todayMonth, -1)
      return { from: `${month}-01`, to: `${month}-31` }
    }
    const count = preset === 'three' ? 3 : preset === 'six' ? 6 : 12
    return { from: `${shiftMonth(todayMonth, 1 - count)}-01`, to: `${todayMonth}-31` }
  }, [preset, from, to, todayMonth])
  const selected = movements.filter(item => item.date >= range.from && item.date <= range.to)
  const expenses = selected.filter(item => item.type === 'expense')
  const income = selected.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0)
  const days = Math.max(1, Math.ceil((new Date(`${range.to}T12:00:00`).getTime() - new Date(`${range.from}T12:00:00`).getTime()) / 86400000) + 1)
  const firstMonth = range.from.slice(0, 7)
  const lastMonth = range.to.slice(0, 7)
  const monthCount = Math.max(1, (Number(lastMonth.slice(0, 4)) - Number(firstMonth.slice(0, 4))) * 12 + Number(lastMonth.slice(5, 7)) - Number(firstMonth.slice(5, 7)) + 1)

  const categoryMap = new Map<number, number>()
  expenses.forEach(item => categoryMap.set(item.categoryId, (categoryMap.get(item.categoryId) ?? 0) + item.amount))
  const categoryData = [...categoryMap.entries()]
    .map(([id, value]) => ({ id, name: categoryLabel(id, categories), value }))
    .sort((a, b) => b.value - a.value)

  const monthDataCount = preset === 'year' ? 12 : preset === 'three' ? 3 : preset === 'six' ? 6 : preset === 'custom' ? Math.min(12, monthCount) : 2
  const chartEndMonth = preset === 'previous' ? shiftMonth(todayMonth, -1) : lastMonth
  const monthData = Array.from({ length: monthDataCount }, (_, index) => {
    const month = shiftMonth(chartEndMonth, index - monthDataCount + 1)
    const items = movements.filter(item => item.date.startsWith(month))
    return {
      month: new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'America/Bogota' }).format(new Date(`${month}-15T12:00:00-05:00`)),
      Ingresos: items.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0),
      Gastos: items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    }
  })

  const methods = new Map<string, number>()
  expenses.forEach(item => methods.set(item.paymentMethod, (methods.get(item.paymentMethod) ?? 0) + item.amount))
  const methodData = [...methods.entries()].map(([name, value]) => ({ name, value }))
  const cardData = cards.map(card => ({
    name: card.name,
    Gastos: expenses.filter(item => item.cardId === card.id).reduce((sum, item) => sum + item.amount, 0),
    Deuda: calcCardDebt(card.id!, movements, payments)
  })).filter(item => item.Gastos > 0 || item.Deuda > 0)
  const currentMonthCategories = new Map<number, number>()
  movements.filter(item => item.type === 'expense' && item.date.startsWith(todayMonth)).forEach(item => {
    currentMonthCategories.set(item.categoryId, (currentMonthCategories.get(item.categoryId) ?? 0) + item.amount)
  })
  const currentMonthTop = [...currentMonthCategories.entries()]
    .map(([id, value]) => ({ name: categoryLabel(id, categories), value }))
    .sort((a, b) => b.value - a.value)[0]
  const previousMonth = shiftMonth(todayMonth, -1)
  const prevRestaurant = movements.filter(item => item.type === 'expense' && item.date.startsWith(previousMonth) && categories.find(c => c.id === item.categoryId)?.name === 'Restaurantes').reduce((sum, item) => sum + item.amount, 0)
  const currentRestaurant = movements.filter(item => item.type === 'expense' && item.date.startsWith(todayMonth) && categories.find(c => c.id === item.categoryId)?.name === 'Restaurantes').reduce((sum, item) => sum + item.amount, 0)
  const transportNow = movements.filter(item => item.type === 'expense' && item.date.startsWith(todayMonth) && categories.find(c => c.id === item.categoryId)?.name === 'Transporte').reduce((sum, item) => sum + item.amount, 0)
  const transportBefore = movements.filter(item => item.type === 'expense' && item.date.startsWith(previousMonth) && categories.find(c => c.id === item.categoryId)?.name === 'Transporte').reduce((sum, item) => sum + item.amount, 0)
  const monthlyIncome = movements.filter(item => item.type === 'income' && item.date.startsWith(todayMonth)).reduce((sum, item) => sum + item.amount, 0)
  const monthlyExpense = movements.filter(item => item.type === 'expense' && item.date.startsWith(todayMonth)).reduce((sum, item) => sum + item.amount, 0)
  const spendingRate = monthlyIncome ? Math.round(monthlyExpense / monthlyIncome * 100) : null
  const recommendations: string[] = []
  if (currentMonthTop) recommendations.push(`Tu categoría con mayor gasto este mes es ${currentMonthTop.name}.`)
  if (prevRestaurant > 0 && currentRestaurant > prevRestaurant) recommendations.push(`Gastaste ${Math.round((currentRestaurant / prevRestaurant - 1) * 100)}% más en restaurantes que el mes pasado.`)
  if (transportBefore > 0 && transportNow > transportBefore) recommendations.push('Tus gastos de transporte aumentaron frente al mes pasado.')
  if (spendingRate !== null) recommendations.push(`Este mes gastaste el ${spendingRate}% de tus ingresos.`)

  return <div className="page-stack">
    <section className="panel">
      <div className="panel-heading"><div><h2>Periodo de análisis</h2><p>Las estadísticas se calculan a partir de tus movimientos registrados.</p></div></div>
      <div className="analytics-controls"><label>Periodo<select value={preset} onChange={event => setPreset(event.target.value as Preset)}><option value="month">Este mes</option><option value="previous">Mes anterior</option><option value="three">Últimos tres meses</option><option value="six">Últimos seis meses</option><option value="year">Último año</option><option value="custom">Periodo personalizado</option></select></label>
        {preset === 'custom' && <><label>Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Hasta<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label></>}
      </div>
    </section>
    <div className="stats-grid analytics-stats"><article className="stat-card"><span>Ingresos</span><strong>{selected.length ? formatMoney(income) : '—'}</strong><small>{selected.length ? 'En el periodo' : 'Sin movimientos registrados'}</small></article><article className="stat-card"><span>Total de egresos</span><strong>{selected.length ? formatMoney(totalExpenses) : '—'}</strong><small>No incluye abonos de tarjetas ni aportes</small></article><article className="stat-card"><span>Ahorro / balance</span><strong className={income - totalExpenses < 0 ? 'negative' : 'positive'}>{selected.length ? formatMoney(income - totalExpenses) : '—'}</strong><small>Ingresos menos gastos</small></article><article className="stat-card"><span>Promedio diario de gastos</span><strong>{selected.length ? formatMoney(totalExpenses / days) : '—'}</strong><small>{selected.length ? `${days} días del periodo` : 'Sin datos para promediar'}</small></article><article className="stat-card"><span>Promedio mensual</span><strong>{selected.length ? formatMoney(totalExpenses / monthCount) : '—'}</strong><small>{selected.length ? `${monthCount} ${monthCount === 1 ? 'mes' : 'meses'} del periodo` : 'Sin datos para promediar'}</small></article></div>

    <div className="chart-grid">
      <section className="panel chart-panel chart-wide"><div className="panel-heading"><div><h2>Comparación mensual</h2><p>Ingresos frente a gastos</p></div></div>
        {selected.length ? <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" /><XAxis dataKey="month" /><YAxis tickFormatter={value => `$${Number(value).toLocaleString('es-CO')}`} width={90} /><Tooltip formatter={value => formatMoney(Number(value))} /><Legend /><Bar dataKey="Ingresos" fill="#368466" radius={[6, 6, 0, 0]} /><Bar dataKey="Gastos" fill="#a281c1" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <div className="empty-state">No hay movimientos en este periodo. No se estiman valores.</div>}
      </section>
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Gastos por categoría</h2><p>Porcentaje del gasto total</p></div></div>
        {categoryData.length ? <><div className="chart-container"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78}>{categoryData.map((item, index) => <Cell key={item.id} fill={categories.find(c => c.id === item.id)?.color ?? COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={value => formatMoney(Number(value))} /></PieChart></ResponsiveContainer></div><div className="ranked-list">{categoryData.map((item, index) => <div key={item.id}><span>{index + 1}. {item.name}</span><strong>{totalExpenses ? Math.round(item.value / totalExpenses * 100) : 0}% · {formatMoney(item.value)}</strong></div>)}</div></> : <div className="empty-state">Sin gastos registrados.</div>}
      </section>
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Gastos por método</h2><p>Desglose en el periodo</p></div></div>
        {methodData.length ? <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={methodData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={80}>{methodData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={value => formatMoney(Number(value))} /><Legend /></PieChart></ResponsiveContainer></div> : <div className="empty-state">Sin datos para mostrar.</div>}
      </section>
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Gastos y deuda por tarjeta</h2><p>Compras del periodo y saldo de deuda actual</p></div></div>
        {cardData.length ? <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><BarChart data={cardData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" /><XAxis type="number" tickFormatter={value => `$${Number(value).toLocaleString('es-CO')}`} /><YAxis dataKey="name" type="category" width={120} /><Tooltip formatter={value => formatMoney(Number(value))} /><Legend /><Bar dataKey="Gastos" fill="#b28bcd" radius={[0, 5, 5, 0]} /><Bar dataKey="Deuda" fill="#438b70" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <div className="empty-state">Sin compras ni deudas de tarjetas registradas.</div>}
      </section>
    </div>
    <section className="panel"><div className="panel-heading"><div><h2>Recomendaciones basadas en tus datos</h2><p>Solo se muestran cuando hay información suficiente.</p></div></div>
      {recommendations.length ? <ul className="recommendations">{recommendations.map((text, index) => <li key={index}><span>✦</span>{text}</li>)}</ul> : <div className="empty-state">Aún no hay suficientes movimientos para generar recomendaciones. Registra ingresos y gastos reales.</div>}
    </section>
  </div>
}
