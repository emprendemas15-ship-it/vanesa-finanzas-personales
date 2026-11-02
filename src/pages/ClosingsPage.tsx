import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, LockKeyhole } from 'lucide-react'
import { db } from '../db'
import { calcCardDebt, categoryLabel, formatMoney, monthName, shiftMonth } from '../utils'
import type { ClosingData } from '../types'

interface Props { month: string }

export default function ClosingsPage({ month }: Props) {
  const movements = useLiveQuery(() => db.movements.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.cardPayments.toArray(), []) ?? []
  const closings = useLiveQuery(() => db.closings.orderBy('month').reverse().toArray(), []) ?? []
  const [selectedId, setSelectedId] = useState<number>()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const items = movements.filter(item => item.date.startsWith(month))
  const incomes = items.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const expenses = items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  const categoryTotals: Record<string, number> = {}
  items.filter(item => item.type === 'expense').forEach(item => {
    const name = categoryLabel(item.categoryId, categories)
    categoryTotals[name] = (categoryTotals[name] ?? 0) + item.amount
  })
  const cardTotals: Record<string, number> = {}
  cards.forEach(card => {
    cardTotals[card.name] = items.filter(item => item.cardId === card.id).reduce((sum, item) => sum + item.amount, 0)
  })
  const debts: Record<string, number> = {}
  cards.forEach(card => { debts[card.name] = calcCardDebt(card.id!, movements, payments) })
  const prevMonth = shiftMonth(month, -1)
  const previousMonthExpenses = movements.filter(item => item.type === 'expense' && item.date.startsWith(prevMonth)).reduce((sum, item) => sum + item.amount, 0)
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sin gastos'
  const current: ClosingData = {
    income: incomes,
    expenses,
    balance: incomes - expenses,
    saved: Math.max(0, incomes - expenses),
    topCategory,
    categoryTotals,
    cardTotals,
    debts,
    previousMonthExpenses
  }
  const saved = closings.find(item => item.month === month)
  const active = selectedId ? closings.find(item => item.id === selectedId) : saved
  const data = active?.data ?? current

  async function closeMonth() {
    setError('')
    setMessage('')
    if (!items.length) {
      setError('No hay movimientos en este mes, así que no se guardará un cierre con datos vacíos.')
      return
    }
    if (saved) {
      setError('Este mes ya tiene un cierre guardado. Los cierres existentes son inmutables.')
      return
    }
    try {
      await db.closings.add({ month, data: current, createdAt: new Date().toISOString() })
      setMessage(`Cierre de ${monthName(month)} guardado. Los movimientos no fueron modificados.`)
    } catch (cause) {
      console.error('Error guardando cierre mensual.', cause)
      setError('No se pudo guardar el cierre.')
    }
  }

  function exportReport() {
    const rows = [
      ['Cierre de mes', active?.month ?? monthName(month)],
      ['Ingresos', data.income],
      ['Gastos', data.expenses],
      ['Balance', data.balance],
      ['Ahorro', data.saved],
      ['Categoría de mayor gasto', data.topCategory],
      ['Gastos del mes anterior', data.previousMonthExpenses ?? 0],
      ...Object.entries(data.categoryTotals).map(([name, value]) => [`Categoría: ${name}`, value]),
      ...Object.entries(data.cardTotals).map(([name, value]) => [`Compras ${name}`, value]),
      ...Object.entries(data.debts).map(([name, value]) => [`Deuda ${name}`, value])
    ]
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `cierre-${active?.month ?? month}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="page-stack">
    <section className="panel closing-current">
      <div className="panel-heading"><div><h2>Cierre de mes · {monthName(month)}</h2><p>Resumen calculado desde movimientos guardados. Los cierres quedan como instantáneas inmutables.</p></div>      {saved ? <span className="tag payment"><LockKeyhole size={13} /> Cierre guardado</span> : <button className="button button-primary" disabled={!items.length} onClick={() => void closeMonth()}>Guardar cierre del mes</button>}</div>
      {error && <p className="form-error">{error}</p>}{message && <p className="success-message">{message}</p>}
      {items.length || saved ? <ClosingReport data={saved?.data ?? current} /> : <div className="empty-state">No hay movimientos para este mes. Regístralos antes de generar el cierre.</div>}
      {saved && <p className="muted small">Este mes ya tiene un cierre en el historial. No se sobrescribe aunque cambien los movimientos.</p>}
    </section>
    <section className="panel">
      <div className="panel-heading"><div><h2>Historial de cierres</h2><p>Los resúmenes guardados permanecen disponibles para meses anteriores.</p></div></div>
      {closings.length ? <div className="table-scroll"><table><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th><th>Mayor gasto</th><th>Ver</th></tr></thead><tbody>{closings.map(closing => <tr key={closing.id}><td>{monthName(closing.month)}</td><td>{formatMoney(closing.data.income)}</td><td>{formatMoney(closing.data.expenses)}</td><td>{formatMoney(closing.data.balance)}</td><td>{closing.data.topCategory}</td><td><button className="text-button" onClick={() => setSelectedId(closing.id)}>{selectedId === closing.id ? 'Seleccionado' : 'Consultar'}</button></td></tr>)}</tbody></table></div> : <div className="empty-state">Todavía no hay cierres guardados. Puedes revisar el resumen actual y guardarlo al finalizar el mes.</div>}
    </section>
    {(active || items.length > 0) && <section className="panel"><div className="panel-heading"><div><h2>Reporte visual: {active ? monthName(active.month) : monthName(month)}</h2><p>{active ? 'Instantánea guardada' : 'Vista previa del periodo actual'}</p></div><button className="button button-quiet" onClick={exportReport}><Download size={16} /> Exportar reporte CSV</button></div><ClosingReport data={data} /></section>}
  </div>
}

function ClosingReport({ data }: { data: ClosingData }) {
  const comparison = data.previousMonthExpenses ?? 0
  const percent = comparison ? Math.round((data.expenses / comparison - 1) * 100) : undefined
  return <div className="closing-grid">
    <div className="closing-stat"><span>Total de ingresos</span><strong>{formatMoney(data.income)}</strong></div>
    <div className="closing-stat"><span>Total de gastos</span><strong>{formatMoney(data.expenses)}</strong></div>
    <div className="closing-stat"><span>Balance final</span><strong>{formatMoney(data.balance)}</strong></div>
    <div className="closing-stat"><span>Total ahorrado</span><strong>{formatMoney(data.saved)}</strong></div>
    <div className="closing-stat"><span>Mayor gasto</span><strong>{data.topCategory}</strong></div>
    <div className="closing-stat"><span>Comparación con mes anterior</span><strong>{percent === undefined ? 'Sin datos anteriores' : `${percent > 0 ? '+' : ''}${percent}% en gastos`}</strong></div>
    <div className="closing-list"><h3>Gastos por categoría</h3>{Object.entries(data.categoryTotals).length ? Object.entries(data.categoryTotals).map(([name, value]) => <div key={name}><span>{name}</span><strong>{formatMoney(value)}</strong></div>) : <p className="muted">Sin gastos.</p>}</div>
    <div className="closing-list"><h3>Compras y deudas por tarjeta</h3>{Object.keys(data.cardTotals).map(name => <div key={name}><span>{name} · compras</span><strong>{formatMoney(data.cardTotals[name])}</strong></div>)}{Object.keys(data.debts).map(name => <div key={`debt-${name}`}><span>{name} · deuda pendiente</span><strong>{formatMoney(data.debts[name])}</strong></div>)}</div>
  </div>
}
