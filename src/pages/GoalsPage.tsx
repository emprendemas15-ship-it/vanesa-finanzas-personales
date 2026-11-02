import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Target, Trash2 } from 'lucide-react'
import { db } from '../db'
import { formatMoney, today } from '../utils'

export default function GoalsPage() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? []
  const contributions = useLiveQuery(() => db.contributions.toArray(), []) ?? []
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [goalId, setGoalId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  async function addGoal(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || Number(target) <= 0) return setError('Ingresa un nombre y un objetivo mayor que cero.')
    try {
      await db.goals.add({ name: name.trim(), target: Number(target), createdAt: new Date().toISOString() })
      setName('')
      setTarget('')
      setError('')
    } catch (cause) {
      console.error('No se pudo guardar la meta.', cause)
      setError('No se pudo guardar la meta en el dispositivo.')
    }
  }

  async function addContribution(event: FormEvent) {
    event.preventDefault()
    if (!goalId || Number(amount) <= 0 || !date) return setError('Selecciona una meta, fecha y aporte mayor que cero.')
    try {
      await db.contributions.add({ goalId: Number(goalId), amount: Number(amount), date, notes: notes.trim() })
      setAmount('')
      setNotes('')
      setGoalId('')
      setError('')
    } catch (cause) {
      console.error('No se pudo guardar el aporte.', cause)
      setError('No se pudo guardar el aporte en el dispositivo.')
    }
  }

  async function removeGoal(id: number, title: string) {
    if (!window.confirm(`¿Eliminar la meta “${title}” y sus aportes? Esto no modifica ingresos ni gastos.`)) return
    try {
      await db.transaction('rw', db.goals, db.contributions, async () => {
        await db.contributions.where('goalId').equals(id).delete()
        await db.goals.delete(id)
      })
    } catch (cause) {
      console.error('No se pudo eliminar la meta.', cause)
      setError('No se pudo eliminar la meta y sus aportes.')
    }
  }

  return <div className="page-stack">
    <div className="notice"><Target size={18} /><span>Los aportes de metas se registran aparte: no son gastos adicionales ni ingresos. Mantén un respaldo de tus datos localmente.</span></div>
    <div className="two-column">
      <section className="panel"><div className="panel-heading"><div><h2>Crear meta</h2><p>Define una meta y consulta su avance.</p></div></div>
        <form className="form-grid" onSubmit={event => void addGoal(event)}><label className="span-two">Nombre de la meta<input maxLength={70} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Fondo de emergencia" required /></label><label className="span-two">Valor objetivo<input type="number" min="1" step="1" value={target} onChange={event => setTarget(event.target.value)} placeholder="2000000" required /></label><div className="form-actions span-two"><button className="button button-primary"><Plus size={16} />Crear meta</button></div></form>
      </section>
      <section className="panel"><div className="panel-heading"><div><h2>Registrar aporte</h2><p>El aporte se asocia a una meta, sin alterar el flujo de caja.</p></div></div>
        <form className="form-grid" onSubmit={event => void addContribution(event)}><label className="span-two">Meta<select value={goalId} onChange={event => setGoalId(event.target.value)} required><option value="">Selecciona una meta</option>{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label><label>Valor del aporte<input type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} required /></label><label>Fecha<input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><label className="span-two">Nota<input maxLength={100} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Opcional" /></label><div className="form-actions span-two"><button className="button button-primary"><Plus size={16} />Guardar aporte</button></div></form>
      </section>
    </div>
    {error && <p className="form-error">{error}</p>}
    <section className="goal-grid">{goals.map(goal => {
      const saved = contributions.filter(item => item.goalId === goal.id).reduce((sum, item) => sum + item.amount, 0)
      const percent = Math.min(100, Math.round(saved / goal.target * 100))
      return <article className="panel goal-card" key={goal.id}>
        <div className="goal-title"><span className="category-color">{'🎯'}</span><div><h2>{goal.name}</h2><small>Meta de ahorro</small></div><button className="icon-button compact danger-icon" aria-label={`Eliminar meta ${goal.name}`} onClick={() => void removeGoal(goal.id!, goal.name)}><Trash2 size={16} /></button></div>
        <div className="goal-amounts"><strong>{formatMoney(saved)}</strong><span>de {formatMoney(goal.target)}</span></div>
        <div className="progress-track"><div style={{ width: `${percent}%` }} /></div>
        <div className="goal-progress-copy"><span>{percent}% completado</span><strong>Faltan {formatMoney(Math.max(0, goal.target - saved))}</strong></div>
        <div className="contribution-list">{contributions.filter(item => item.goalId === goal.id).sort((a, b) => b.date.localeCompare(a.date)).map(item => <div key={item.id}><span>{item.date}{item.notes ? ` · ${item.notes}` : ''}</span><strong>{formatMoney(item.amount)}</strong></div>)}</div>
      </article>
    })}{!goals.length && <div className="panel empty-state">Aún no tienes metas. Crea una para hacer seguimiento a tus ahorros.</div>}</section>
  </div>
}
