import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts'
import { db } from '../db'
import { calcCardDebt, categoryLabel, formatMoney, monthName, shiftMonth } from '../utils'

interface Props {
  month: string
  onMonthChange: (month: string) => void
}

const COLORS = ['#36785d', '#a881ce', '#dc9457', '#5484a5', '#d46979', '#9caa61', '#6c71b8']

export default function DashboardPage({ month, onMonthChange }: Props) {
  const movements = useLiveQuery(() => db.movements.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.cardPayments.toArray(), []) ?? []
  const monthMovements = movements.filter(item => item.date.startsWith(month))
  const income = monthMovements.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const expenses = monthMovements.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  const balance = income - expenses
  const creditPurchases = monthMovements.filter(item => item.type === 'expense' && item.cardId).reduce((sum, item) => sum + item.amount, 0)
  const debt = cards.reduce((sum, card) => sum + calcCardDebt(card.id!, movements, payments), 0)
  const spendPercent = income ? Math.round((expenses / income) * 100) : null
  const categoryTotals = new Map<number, number>()
  monthMovements.filter(item => item.type === 'expense').forEach(item => {
    categoryTotals.set(item.categoryId, (categoryTotals.get(item.categoryId) ?? 0) + item.amount)
  })
  const categoryData = [...categoryTotals.entries()]
    .map(([id, value]) => ({ name: categoryLabel(id, categories), value }))
    .sort((a, b) => b.value - a.value)
  const top = categoryData[0]
  const recent = [...movements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  const chartMonths = Array.from({ length: 6 }, (_, index) => {
    const key = shiftMonth(month, index - 5)
    const items = movements.filter(item => item.date.startsWith(key))
    return {
      month: new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'America/Bogota' })
        .format(new Date(`${key}-15T12:00:00-05:00`)),
      Ingresos: items.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0),
      Gastos: items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    }
  })
  const methodTotals = new Map<string, number>()
  monthMovements.filter(item => item.type === 'expense').forEach(item => {
    methodTotals.set(item.paymentMethod, (methodTotals.get(item.paymentMethod) ?? 0) + item.amount)
  })
  const methodData = [...methodTotals.entries()].map(([name, value]) => ({ name, value }))

  return (
    <div className="page-stack">
      <div className="month-control">
        <button className="icon-button" aria-label="Mes anterior" onClick={() => onMonthChange(shiftMonth(month, -1))}>‹</button>
        <div><span className="muted small">Periodo seleccionado</span><strong>{monthName(month)}</strong></div>
        <button className="icon-button" aria-label="Mes siguiente" onClick={() => onMonthChange(shiftMonth(month, 1))}>›</button>
      </div>

      <div className="stats-grid">
        <article className="stat-card primary-stat"><span>Saldo disponible</span><strong>{formatMoney(
          movements.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
          - movements.filter(item => item.type === 'expense' && !item.cardId).reduce((sum, item) => sum + item.amount, 0)
          - payments.reduce((sum, item) => sum + item.amount, 0)
        )}</strong><small>Después de gastos directos y abonos</small></article>
        <article className="stat-card"><span>Ingresos del mes</span><strong>{formatMoney(income)}</strong><small>{monthMovements.filter(item => item.type === 'income').length} movimientos</small></article>
        <article className="stat-card"><span>Gastos del mes</span><strong>{formatMoney(expenses)}</strong><small>{monthMovements.filter(item => item.type === 'expense').length} movimientos</small></article>
        <article className="stat-card"><span>Balance mensual</span><strong className={balance < 0 ? 'negative' : 'positive'}>{formatMoney(balance)}</strong><small>{balance < 0 ? 'Gastos superiores a ingresos' : 'Ingresos menos gastos'}</small></article>
        <article className="stat-card"><span>Compras con tarjetas</span><strong>{formatMoney(creditPurchases)}</strong><small>Compras de crédito del mes</small></article>
        <article className="stat-card"><span>Deuda pendiente</span><strong>{formatMoney(debt)}</strong><small>Deuda neta de abonos registrados</small></article>
        <article className="stat-card"><span>Ingresos gastados</span><strong>{spendPercent === null ? '—' : `${spendPercent}%`}</strong><small>{spendPercent === null ? 'Registra ingresos para calcularlo' : 'Del ingreso del periodo'}</small></article>
        <article className="stat-card"><span>Ahorro del mes</span><strong>{formatMoney(Math.max(0, balance))}</strong><small>Balance positivo, sin contar aportes de metas</small></article>
      </div>

      <div className="chart-grid">
        <article className="panel chart-panel chart-wide">
          <div className="panel-heading"><div><h2>Ingresos y gastos</h2><p>Comparación de los últimos seis meses</p></div></div>
          {chartMonths.some(item => item.Ingresos || item.Gastos) ? (
            <div className="chart-container"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMonths} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={value => `$${Number(value).toLocaleString('es-CO')}`} tickLine={false} axisLine={false} width={90} />
                <Tooltip formatter={value => formatMoney(Number(value))} />
                <Legend />
                <Bar dataKey="Ingresos" fill="#368466" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Gastos" fill="#a281c1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <EmptyState text="Aún no hay movimientos para mostrar en la gráfica." />}
        </article>
        <article className="panel chart-panel">
          <div className="panel-heading"><div><h2>Gastos por categoría</h2><p>Distribución de {monthName(month)}</p></div></div>
          {categoryData.length ? <div className="chart-container"><ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={3}>
              {categoryData.map((item, index) => <Cell key={item.name} fill={categories.find(category => category.name === item.name)?.color ?? COLORS[index % COLORS.length]} />)}
            </Pie><Tooltip formatter={value => formatMoney(Number(value))} /><Legend /></PieChart>
          </ResponsiveContainer></div> : <EmptyState text="No hay gastos registrados en este mes." />}
          {top && <div className="highlight-note"><span>Mayor gasto</span><strong>{top.name} · {formatMoney(top.value)}</strong></div>}
        </article>
        <article className="panel chart-panel chart-wide">
          <div className="panel-heading"><div><h2>Evolución de gastos</h2><p>Seis meses, calculados desde tus movimientos</p></div></div>
          {chartMonths.some(item => item.Gastos) ? <div className="chart-container"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartMonths}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickFormatter={value => `$${Number(value).toLocaleString('es-CO')}`} width={90} tickLine={false} axisLine={false} /><Tooltip formatter={value => formatMoney(Number(value))} /><Bar dataKey="Gastos" fill="#b28bcd" radius={[7, 7, 0, 0]} /></BarChart>
          </ResponsiveContainer></div> : <EmptyState text="Registra gastos para consultar la tendencia." />}
        </article>
        <article className="panel chart-panel">
          <div className="panel-heading"><div><h2>Gastos por método</h2><p>Método de pago en el mes</p></div></div>
          {methodData.length ? <div className="chart-container"><ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={methodData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
              {methodData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
            </Pie><Tooltip formatter={value => formatMoney(Number(value))} /><Legend /></PieChart>
          </ResponsiveContainer></div> : <EmptyState text="No hay métodos de pago que resumir." />}
        </article>
      </div>

      <div className="two-column">
        <article className="panel">
          <div className="panel-heading"><div><h2>¿En qué estoy gastando más?</h2><p>Según los gastos registrados en este mes</p></div></div>
          {top ? <div className="top-spend"><span className="top-spend-icon">{categories.find(category => category.name === top.name)?.icon ?? '✦'}</span><div><strong>{top.name}</strong><b>{formatMoney(top.value)}</b><small>{expenses ? `${Math.round(top.value / expenses * 100)}% de tus gastos` : ''}</small></div></div> : <EmptyState text="Todavía no hay gastos en este periodo." />}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><h2>Últimos movimientos</h2><p>Actividad reciente registrada</p></div></div>
          {recent.length ? <div className="movement-list">{recent.map(item => <div className="movement-row" key={item.id}>
            <div className="movement-icon">{categories.find(category => category.id === item.categoryId)?.icon ?? '✦'}</div>
            <div className="movement-info"><strong>{item.description}</strong><small>{categoryLabel(item.categoryId, categories)} · {item.date}</small></div>
            <b className={item.type === 'income' ? 'positive' : 'negative'}>{item.type === 'income' ? '+' : '−'}{formatMoney(item.amount)}</b>
          </div>)}</div> : <EmptyState text="Tus movimientos aparecerán aquí." />}
        </article>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>
}
