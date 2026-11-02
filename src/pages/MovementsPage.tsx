import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../db'
import { DEFAULT_METHODS, formatMoney, formatDate, today } from '../utils'
import type { Movement, MovementType } from '../types'

const blankMovement = () => ({
  type: 'expense' as MovementType,
  description: '',
  amount: '',
  date: today(),
  categoryId: '',
  paymentMethod: 'Efectivo',
  account: '',
  cardId: '',
  notes: ''
})

export default function MovementsPage() {
  const movements = useLiveQuery(() => db.movements.orderBy('date').reverse().toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? []
  const [form, setForm] = useState(blankMovement)
  const [editing, setEditing] = useState<number>()
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [error, setError] = useState('')

  const availableCategories = categories.filter(category =>
    !category.archived && (category.kind === form.type || category.kind === 'both')
  )
  const filtered = movements.filter(item =>
    (typeFilter === 'all' || item.type === typeFilter)
    && (categoryFilter === 'all' || item.categoryId === Number(categoryFilter))
    && (methodFilter === 'all' || item.paymentMethod === methodFilter)
    && (!dateFilter || item.date === dateFilter)
    && (!accountFilter || `${item.account} ${cards.find(card => card.id === item.cardId)?.name ?? ''}`.toLowerCase().includes(accountFilter.toLowerCase()))
  )

  function reset() {
    setForm(blankMovement())
    setEditing(undefined)
    setError('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.date || !form.categoryId) {
      setError('Completa la descripción, un valor mayor que cero, fecha y categoría.')
      return
    }

    const isCredit = form.paymentMethod === 'Tarjeta de crédito'
    if (isCredit && !form.cardId) {
      setError('Selecciona la tarjeta usada para esta compra.')
      return
    }
    if (!isCredit && form.cardId) {
      setError('Solo asocia una tarjeta cuando el método sea Tarjeta de crédito.')
      return
    }

    const record: Movement = {
      type: form.type,
      description: form.description.trim(),
      amount,
      date: form.date,
      categoryId: Number(form.categoryId),
      paymentMethod: form.paymentMethod as Movement['paymentMethod'],
      account: form.account.trim(),
      cardId: isCredit ? Number(form.cardId) : undefined,
      notes: form.notes.trim(),
      createdAt: editing ? movements.find(item => item.id === editing)?.createdAt ?? new Date().toISOString() : new Date().toISOString()
    }

    try {
      if (editing) await db.movements.update(editing, record)
      else await db.movements.add(record)
      reset()
    } catch (cause) {
      console.error('No se pudo guardar el movimiento en IndexedDB.', cause)
      setError('No se pudo guardar el movimiento localmente. Revisa el espacio disponible e inténtalo de nuevo.')
    }
  }

  function edit(item: Movement) {
    setEditing(item.id)
    setForm({
      type: item.type,
      description: item.description,
      amount: String(item.amount),
      date: item.date,
      categoryId: String(item.categoryId),
      paymentMethod: item.paymentMethod,
      account: item.account,
      cardId: item.cardId ? String(item.cardId) : '',
      notes: item.notes
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(item: Movement) {
    if (!window.confirm(`¿Eliminar “${item.description}” por ${formatMoney(item.amount)}? Esta acción no se puede deshacer.`)) return
    try {
      await db.movements.delete(item.id!)
    } catch (cause) {
      console.error('No se pudo eliminar el movimiento.', cause)
      setError('No se pudo eliminar el movimiento.')
    }
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-heading"><div><h2>{editing ? 'Editar movimiento' : 'Registrar movimiento'}</h2><p>Los datos se guardan únicamente en este dispositivo.</p></div></div>
        <form className="form-grid" onSubmit={submit}>
          <label>Tipo
            <select value={form.type} onChange={event => {
              const type = event.target.value as MovementType
              setForm({
                ...form,
                type,
                categoryId: '',
                paymentMethod: type === 'income' && form.paymentMethod === 'Tarjeta de crédito' ? 'Cuenta bancaria' : form.paymentMethod,
                cardId: type === 'income' ? '' : form.cardId
              })
            }}>
              <option value="expense">Gasto</option><option value="income">Ingreso</option>
            </select>
          </label>
          <label>Descripción
            <input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={100} required placeholder="Ej. Mercado de la semana" />
          </label>
          <label>Valor en pesos
            <input type="number" min="1" step="1" inputMode="numeric" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} required placeholder="200000" />
          </label>
          <label>Fecha
            <input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} required />
          </label>
          <label>Categoría
            <select value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })} required>
              <option value="">Selecciona una categoría</option>
              {availableCategories.map(category => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}
            </select>
          </label>
          <label>Método de pago
            <select value={form.paymentMethod} onChange={event => setForm({ ...form, paymentMethod: event.target.value, cardId: event.target.value === 'Tarjeta de crédito' ? form.cardId : '' })}>
              {DEFAULT_METHODS.map(method => <option key={method}>{method}</option>)}
            </select>
          </label>
          {form.paymentMethod === 'Tarjeta de crédito' ? (
            <label>Tarjeta
              <select value={form.cardId} onChange={event => setForm({ ...form, cardId: event.target.value })} required>
                <option value="">Selecciona una tarjeta</option>
                {cards.map(card => <option key={card.id} value={card.id}>{card.name} · {card.bank}</option>)}
              </select>
            </label>
          ) : <label>Cuenta o referencia<input value={form.account} onChange={event => setForm({ ...form, account: event.target.value })} maxLength={80} placeholder="Opcional" /></label>}
          <label className="span-two">Notas opcionales
            <textarea rows={2} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} maxLength={400} placeholder="Información adicional" />
          </label>
          {error && <p className="form-error span-two" role="alert">{error}</p>}
          <div className="form-actions span-two">
            <button type="submit" className="button button-primary"><Plus size={17} />{editing ? 'Guardar cambios' : 'Guardar movimiento'}</button>
            {editing && <button type="button" className="button button-quiet" onClick={reset}>Cancelar edición</button>}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h2>Historial de movimientos</h2><p>{filtered.length} registros · los pagos de tarjeta aparecen en su propio historial.</p></div></div>
        <div className="filters-row">
          <select aria-label="Filtrar por tipo" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">Todos los tipos</option><option value="income">Ingresos</option><option value="expense">Gastos</option></select>
          <select aria-label="Filtrar por categoría" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">Todas las categorías</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <select aria-label="Filtrar por método" value={methodFilter} onChange={event => setMethodFilter(event.target.value)}><option value="all">Todos los métodos</option>{DEFAULT_METHODS.map(method => <option key={method}>{method}</option>)}</select>
          <input aria-label="Filtrar por fecha" type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />
          <input aria-label="Filtrar por cuenta o tarjeta" value={accountFilter} onChange={event => setAccountFilter(event.target.value)} placeholder="Cuenta o tarjeta" />
        </div>
        <div className="table-scroll"><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Categoría</th><th>Valor</th><th>Fecha</th><th>Método / tarjeta</th><th>Cuenta</th><th>Acciones</th></tr></thead>
          <tbody>{filtered.map(item => <tr key={item.id}>
            <td><span className={`tag ${item.type}`}>{item.type === 'income' ? 'Ingreso' : 'Gasto'}</span></td>
            <td><strong>{item.description}</strong>{item.notes && <small className="table-subtext">{item.notes}</small>}</td>
            <td>{categories.find(category => category.id === item.categoryId)?.name ?? 'Categoría eliminada'}</td>
            <td className={item.type === 'income' ? 'positive' : 'negative'}>{item.type === 'income' ? '+' : '−'}{formatMoney(item.amount)}</td>
            <td>{formatDate(item.date)}</td>
            <td>{item.paymentMethod}{item.cardId && <small className="table-subtext">{cards.find(card => card.id === item.cardId)?.name}</small>}</td>
            <td>{item.account || '—'}</td>
            <td><div className="inline-actions"><button title="Editar" aria-label={`Editar ${item.description}`} className="icon-button compact" onClick={() => edit(item)}><Pencil size={15} /></button><button title="Eliminar" aria-label={`Eliminar ${item.description}`} className="icon-button compact danger-icon" onClick={() => void remove(item)}><Trash2 size={15} /></button></div></td>
          </tr>)}
          {!filtered.length && <tr><td className="empty-table" colSpan={8}>No hay movimientos que coincidan. Los resultados no usan datos de ejemplo.</td></tr>}
          </tbody></table></div>
      </section>
    </div>
  )
}
