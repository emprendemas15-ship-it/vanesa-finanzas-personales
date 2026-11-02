import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../db'
import { formatMoney } from '../utils'
import type { Category } from '../types'

const blank = { name: '', kind: 'expense' as Category['kind'], color: '#4b8f71', icon: '✦', parentId: '' }

export default function CategoriesPage() {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const movements = useLiveQuery(() => db.movements.toArray(), []) ?? []
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number>()
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState('')
  const listed = categories.filter(category => showArchived || !category.archived)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) return setError('Escribe un nombre para la categoría.')
    if (categories.some(category => category.name.toLocaleLowerCase() === name.toLocaleLowerCase() && category.id !== editing && !category.archived)) {
      return setError('Ya existe una categoría activa con ese nombre.')
    }
    if (form.parentId && Number(form.parentId) === editing) return setError('Una categoría no puede ser subcategoría de sí misma.')
    try {
      const record: Category = {
        name,
        kind: form.kind,
        color: form.color,
        icon: form.icon.trim() || '✦',
        parentId: form.parentId ? Number(form.parentId) : undefined
      }
      if (editing) await db.categories.update(editing, record)
      else await db.categories.add(record)
      setForm(blank)
      setEditing(undefined)
      setError('')
    } catch (cause) {
      console.error('Error guardando categoría local.', cause)
      setError('No se pudo guardar la categoría.')
    }
  }

  async function archive(category: Category) {
    const hasChildren = categories.some(item => item.parentId === category.id)
    const used = movements.some(item =>
      item.categoryId === category.id
      || (hasChildren && categories.some(child => child.parentId === category.id && child.id === item.categoryId))
    )
    const message = used || hasChildren
      ? `¿Eliminar “${category.name}”? Como tiene movimientos o subcategorías, se archivará para conservar el historial.`
      : `¿Eliminar “${category.name}”? Podrás crearla nuevamente si la necesitas.`
    if (!window.confirm(message)) return
    try {
      if (used || hasChildren) await db.categories.update(category.id!, { archived: true })
      else await db.categories.delete(category.id!)
    } catch (cause) {
      console.error('No se pudo archivar la categoría.', cause)
      setError('No se pudo archivar la categoría.')
    }
  }

  async function restore(category: Category) {
    try {
      await db.categories.update(category.id!, { archived: false })
      setError('')
    } catch (cause) {
      console.error('No se pudo reactivar la categoría.', cause)
      setError('No se pudo reactivar la categoría.')
    }
  }

  function edit(category: Category) {
    setEditing(category.id)
    setForm({
      name: category.name,
      kind: category.kind,
      color: category.color,
      icon: category.icon,
      parentId: category.parentId ? String(category.parentId) : ''
    })
    setError('')
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-heading"><div><h2>{editing ? 'Editar categoría' : 'Crear categoría'}</h2><p>Elige nombre, tipo, color, icono y subcategoría. Los cambios se guardan localmente.</p></div></div>
        <form className="form-grid category-form" onSubmit={event => void submit(event)}>
          <label>Nombre<input maxLength={40} required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ej. Mascotas" /></label>
          <label>Tipo<select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as Category['kind'] })}><option value="expense">Gastos</option><option value="income">Ingresos</option><option value="both">Ambos</option></select></label>
          <label>Icono (emoji o símbolo)<input maxLength={8} value={form.icon} onChange={event => setForm({ ...form, icon: event.target.value })} /></label>
          <label>Color<input className="color-input" type="color" value={form.color} onChange={event => setForm({ ...form, color: event.target.value })} /></label>
          <label>Subcategoría de<select value={form.parentId} onChange={event => setForm({ ...form, parentId: event.target.value })}><option value="">Categoría principal</option>{categories.filter(item => !item.archived && !item.parentId && item.id !== editing).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          {error && <p className="form-error span-two">{error}</p>}
          <div className="form-actions span-two"><button className="button button-primary"><Plus size={16} />{editing ? 'Guardar cambios' : 'Agregar categoría'}</button>{editing && <button type="button" className="button button-quiet" onClick={() => { setEditing(undefined); setForm(blank) }}>Cancelar</button>}</div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h2>Tus categorías</h2><p>Consulta los gastos asociados sin perder el historial al archivarlas.</p></div>
          <label className="check-label"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} /> Mostrar archivadas</label>
        </div>
        <div className="category-grid">{listed.map(category => {
          const total = movements.filter(item => item.type === 'expense' && item.categoryId === category.id).reduce((sum, item) => sum + item.amount, 0)
          return <article className={`category-card ${category.archived ? 'archived' : ''}`} key={category.id}>
            <span className="category-color" style={{ backgroundColor: category.color }}>{category.icon}</span>
            <div className="category-card-main"><strong>{category.name}</strong><small>{category.parentId ? `Subcategoría de ${categories.find(parent => parent.id === category.parentId)?.name ?? 'categoría'}` : category.kind === 'income' ? 'Ingresos' : category.kind === 'both' ? 'Ingresos y gastos' : 'Gastos'}{category.archived ? ' · Archivada' : ''}</small><b>{formatMoney(total)}</b><small>Gasto histórico registrado</small></div>
            <div className="inline-actions">{category.archived ? <button className="icon-button compact" aria-label={`Reactivar ${category.name}`} title="Reactivar" onClick={() => void restore(category)}><ArchiveRestore size={16} /></button> : <><button className="icon-button compact" aria-label={`Editar ${category.name}`} title="Editar" onClick={() => edit(category)}><Pencil size={15} /></button><button className="icon-button compact danger-icon" aria-label={`Eliminar ${category.name}`} title="Eliminar" onClick={() => void archive(category)}><Trash2 size={15} /></button></>}</div>
          </article>
        })}</div>
      </section>
    </div>
  )
}
