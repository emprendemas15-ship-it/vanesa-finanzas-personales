import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CreditCard, Pencil, Plus } from 'lucide-react'
import { db } from '../db'
import { calcCardDebt, formatDate, formatMoney, today } from '../utils'

const emptyCard = { name: '', bank: '', type: 'Crédito', limit: '', closingDay: '', dueDay: '' }
const emptyPayment = { cardId: '', amount: '', date: today(), notes: '' }

export default function CardsPage() {
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? []
  const movements = useLiveQuery(() => db.movements.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.cardPayments.orderBy('date').reverse().toArray(), []) ?? []
  const [cardForm, setCardForm] = useState(emptyCard)
  const [editingCard, setEditingCard] = useState<number>()
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const month = today().slice(0, 7)

  async function addCard(event: FormEvent) {
    event.preventDefault()
    if (!cardForm.name.trim() || !cardForm.bank.trim()) return setError('Indica el nombre de la tarjeta y la entidad.')
    const parseDay = (value: string) => value ? Number(value) : undefined
    const closingDay = parseDay(cardForm.closingDay)
    const dueDay = parseDay(cardForm.dueDay)
    if ([closingDay, dueDay].some(day => day !== undefined && (day < 1 || day > 31))) return setError('Los días de corte y pago deben estar entre 1 y 31.')
    const limit = cardForm.limit ? Number(cardForm.limit) : undefined
    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) return setError('El límite debe ser mayor que cero.')
    try {
      const record = {
        ...cardForm,
        name: cardForm.name.trim(),
        bank: cardForm.bank.trim(),
        limit,
        closingDay,
        dueDay,
        createdAt: editingCard ? cards.find(card => card.id === editingCard)?.createdAt ?? new Date().toISOString() : new Date().toISOString()
      }
      if (editingCard) await db.cards.update(editingCard, record)
      else await db.cards.add(record)
      setCardForm(emptyCard)
      setEditingCard(undefined)
      setError('')
      setMessage(editingCard ? 'Tarjeta actualizada.' : 'Tarjeta agregada. No se almacenan números, claves ni CVV.')
    } catch (cause) {
      console.error('Error guardando tarjeta.', cause)
      setError('No se pudo guardar la tarjeta localmente.')
    }
  }

  async function addPayment(event: FormEvent) {
    event.preventDefault()
    const cardId = Number(paymentForm.cardId)
    const amount = Number(paymentForm.amount)
    const debt = calcCardDebt(cardId, movements, payments)
    if (!cardId || !Number.isFinite(amount) || amount <= 0 || !paymentForm.date) return setError('Selecciona tarjeta, fecha y un abono mayor que cero.')
    if (amount > debt) return setError(`El abono supera la deuda actual (${formatMoney(debt)}).`)
    try {
      await db.cardPayments.add({ cardId, amount, date: paymentForm.date, notes: paymentForm.notes.trim(), createdAt: new Date().toISOString() })
      setPaymentForm({ ...emptyPayment, date: today() })
      setError('')
      setMessage('Abono registrado; no se contabilizó como un gasto.')
    } catch (cause) {
      console.error('Error guardando abono.', cause)
      setError('No se pudo guardar el abono.')
    }
  }

  async function removePayment(paymentId: number) {
    if (!window.confirm('¿Eliminar este abono? La deuda de la tarjeta volverá a aumentar por ese valor.')) return
    try {
      await db.cardPayments.delete(paymentId)
      setError('')
    } catch (cause) {
      console.error('No se pudo eliminar el abono.', cause)
      setError('No se pudo eliminar el abono.')
    }
  }

  return (
    <div className="page-stack">
      <div className="notice"><CreditCard size={18} /><span>Solo se registran datos identificativos de la tarjeta (nombre, entidad y fechas). Nunca ingreses números completos, CVV, claves ni contraseñas.</span></div>
      <section className="card-overview">{cards.map(card => {
        const debt = calcCardDebt(card.id!, movements, payments)
        const spent = movements.filter(item => item.type === 'expense' && item.cardId === card.id && item.date.startsWith(month)).reduce((sum, item) => sum + item.amount, 0)
        const available = card.limit === undefined ? undefined : Math.max(0, card.limit - debt)
        return <article className="credit-card-visual" key={card.id}><div className="credit-card-top"><span className="brand-pill">{card.bank}</span><div className="inline-actions"><button title={`Editar ${card.name}`} aria-label={`Editar ${card.name}`} className="icon-button compact" onClick={() => { setEditingCard(card.id); setCardForm({ name: card.name, bank: card.bank, type: card.type, limit: card.limit === undefined ? '' : String(card.limit), closingDay: card.closingDay === undefined ? '' : String(card.closingDay), dueDay: card.dueDay === undefined ? '' : String(card.dueDay) }) }}><Pencil size={14} /></button><CreditCard size={22} /></div></div><div><small>{card.type}</small><h2>{card.name}</h2></div><div className="credit-card-stats"><div><small>Deuda actual</small><strong>{formatMoney(debt)}</strong></div><div><small>Gastado este mes</small><strong>{formatMoney(spent)}</strong></div>{card.limit !== undefined && <div><small>Cupo estimado</small><strong>{formatMoney(available!)}</strong></div>}</div><div className="credit-card-dates"><span>{card.limit === undefined ? 'Límite no definido' : `Límite ${formatMoney(card.limit)}`}</span><span>{card.closingDay ? `Corte día ${card.closingDay}` : ''}{card.dueDay ? ` · Pago día ${card.dueDay}` : ''}</span></div></article>
      })}</section>

      <div className="two-column">
        <section className="panel"><div className="panel-heading"><div><h2>{editingCard ? 'Editar tarjeta' : 'Agregar tarjeta'}</h2><p>Nu y American Express están disponibles inicialmente.</p></div></div>
          <form className="form-grid" onSubmit={event => void addCard(event)}>
            <label>Nombre<input value={cardForm.name} maxLength={50} onChange={event => setCardForm({ ...cardForm, name: event.target.value })} placeholder="Ej. Visa Oro" required /></label>
            <label>Banco o entidad<input value={cardForm.bank} maxLength={60} onChange={event => setCardForm({ ...cardForm, bank: event.target.value })} required /></label>
            <label>Tipo de tarjeta<input value={cardForm.type} maxLength={40} onChange={event => setCardForm({ ...cardForm, type: event.target.value })} /></label>
            <label>Límite de crédito (opcional)<input type="number" min="1" step="1" value={cardForm.limit} onChange={event => setCardForm({ ...cardForm, limit: event.target.value })} /></label>
            <label>Día de corte<input type="number" min="1" max="31" value={cardForm.closingDay} onChange={event => setCardForm({ ...cardForm, closingDay: event.target.value })} placeholder="1–31" /></label>
            <label>Día límite de pago<input type="number" min="1" max="31" value={cardForm.dueDay} onChange={event => setCardForm({ ...cardForm, dueDay: event.target.value })} placeholder="1–31" /></label>
            <div className="form-actions span-two"><button className="button button-primary"><Plus size={16} />{editingCard ? 'Guardar cambios' : 'Agregar tarjeta'}</button>{editingCard && <button type="button" className="button button-quiet" onClick={() => { setEditingCard(undefined); setCardForm(emptyCard) }}>Cancelar edición</button>}</div>
          </form>
        </section>
        <section className="panel"><div className="panel-heading"><div><h2>Registrar abono</h2><p>Reduce la deuda sin duplicar tus gastos.</p></div></div>
          <form className="form-grid" onSubmit={event => void addPayment(event)}>
            <label>Tarjeta<select value={paymentForm.cardId} onChange={event => setPaymentForm({ ...paymentForm, cardId: event.target.value })} required><option value="">Selecciona tarjeta</option>{cards.map(card => <option key={card.id} value={card.id}>{card.name} · deuda {formatMoney(calcCardDebt(card.id!, movements, payments))}</option>)}</select></label>
            <label>Valor del abono<input type="number" min="1" step="1" value={paymentForm.amount} onChange={event => setPaymentForm({ ...paymentForm, amount: event.target.value })} required /></label>
            <label>Fecha<input type="date" value={paymentForm.date} onChange={event => setPaymentForm({ ...paymentForm, date: event.target.value })} required /></label>
            <label>Nota opcional<input value={paymentForm.notes} maxLength={120} onChange={event => setPaymentForm({ ...paymentForm, notes: event.target.value })} /></label>
            <div className="form-actions span-two"><button className="button button-primary"><Plus size={16} />Registrar abono</button></div>
          </form>
        </section>
      </div>

      {(error || message) && <p className={error ? 'form-error' : 'success-message'} role="status">{error || message}</p>}
      <section className="panel"><div className="panel-heading"><div><h2>Historial de compras y abonos</h2><p>Las compras son gastos. Los abonos disminuyen deuda, pero no son egresos del tablero.</p></div></div>
        <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Tarjeta</th><th>Descripción</th><th>Valor</th><th>Acción</th></tr></thead><tbody>
          {movements.filter(item => item.cardId).map(item => <tr key={`purchase-${item.id}`}><td>{formatDate(item.date)}</td><td><span className="tag expense">Compra</span></td><td>{cards.find(card => card.id === item.cardId)?.name}</td><td>{item.description}</td><td className="negative">−{formatMoney(item.amount)}</td><td>—</td></tr>)}
          {payments.map(item => <tr key={`payment-${item.id}`}><td>{formatDate(item.date)}</td><td><span className="tag payment">Abono</span></td><td>{cards.find(card => card.id === item.cardId)?.name}</td><td>{item.notes || 'Pago de tarjeta'}</td><td className="positive">−{formatMoney(item.amount)}</td><td><button className="text-button danger-text" onClick={() => void removePayment(item.id!)}>Eliminar</button></td></tr>)}
          {!movements.some(item => item.cardId) && !payments.length && <tr><td className="empty-table" colSpan={6}>Todavía no hay compras con tarjeta ni abonos.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  )
}
