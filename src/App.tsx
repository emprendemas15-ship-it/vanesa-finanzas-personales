import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarCheck, ChartNoAxesCombined, CircleHelp, CreditCard,
  Download, FolderOpen, LayoutDashboard, MoreHorizontal, Plus, Settings, ShieldCheck,
  Smartphone, Tags, Target, Trash2, Wallet, Wifi, WifiOff, X
} from 'lucide-react'
import { db, initializeDatabase } from './db'
import { validateImport } from './utils'
import type { Category, CreditCard as CardRecord, GoalContribution, MonthClosing, Movement } from './types'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MovementsPage = lazy(() => import('./pages/MovementsPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const CardsPage = lazy(() => import('./pages/CardsPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const ClosingsPage = lazy(() => import('./pages/ClosingsPage'))
const GoalsPage = lazy(() => import('./pages/GoalsPage'))

type Section = 'dashboard' | 'movements' | 'categories' | 'cards' | 'analytics' | 'closings' | 'goals' | 'settings'

const navigation: { id: Section; label: string; icon: typeof LayoutDashboard; group: string }[] = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard, group: 'Principal' },
  { id: 'movements', label: 'Movimientos', icon: Wallet, group: 'Principal' },
  { id: 'cards', label: 'Tarjetas', icon: CreditCard, group: 'Gestión' },
  { id: 'categories', label: 'Categorías', icon: Tags, group: 'Gestión' },
  { id: 'analytics', label: 'Estadísticas', icon: ChartNoAxesCombined, group: 'Análisis' },
  { id: 'closings', label: 'Cierre de mes', icon: CalendarCheck, group: 'Análisis' },
  { id: 'goals', label: 'Metas de ahorro', icon: Target, group: 'Análisis' },
  { id: 'settings', label: 'Datos y ajustes', icon: Settings, group: 'Ajustes' }
]

const sectionTitles: Record<Section, string> = {
  dashboard: 'Tu dinero, más claro',
  movements: 'Movimientos',
  categories: 'Categorías',
  cards: 'Tarjetas de crédito',
  analytics: 'Estadísticas',
  closings: 'Cierre de mes',
  goals: 'Metas de ahorro',
  settings: 'Datos y ajustes'
}

interface Backup {
  version: 1
  exportedAt: string
  movements: Movement[]
  categories: Category[]
  cards: CardRecord[]
  cardPayments: Awaited<ReturnType<typeof db.cardPayments.toArray>>
  goals: Awaited<ReturnType<typeof db.goals.toArray>>
  contributions: GoalContribution[]
  closings: MonthClosing[]
}

export default function App() {
  const [section, setSection] = useState<Section>('dashboard')
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).format(new Date()))
  const [online, setOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installHelp, setInstallHelp] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [databaseReady, setDatabaseReady] = useState(false)
  const settings = useLiveQuery(() => db.settings.get('preferences'), [])
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    initializeDatabase()
      .then(() => setDatabaseReady(true))
      .catch(cause => {
        console.error('No se pudo inicializar IndexedDB.', cause)
        setError('No se pudo abrir el almacenamiento local. Verifica que el navegador permita guardar datos.')
      })
  }, [])

  useEffect(() => {
    document.body.classList.toggle('dark', settings?.theme === 'dark')
  }, [settings?.theme])

  useEffect(() => {
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    const installHandler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    window.addEventListener('beforeinstallprompt', installHandler)
    return () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
      window.removeEventListener('beforeinstallprompt', installHandler)
    }
  }, [])

  useEffect(() => {
    if (!notice && !error) return
    const timer = window.setTimeout(() => { setNotice(''); setError('') }, 6500)
    return () => window.clearTimeout(timer)
  }, [notice, error])

  async function toggleTheme() {
    if (!settings) return
    await db.settings.update('preferences', { theme: settings.theme === 'dark' ? 'light' : 'dark' })
  }

  async function installApp() {
    if (!installPrompt) {
      setInstallHelp(true)
      return
    }
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  async function exportBackup() {
    try {
      const backup: Backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        movements: await db.movements.toArray(),
        categories: await db.categories.toArray(),
        cards: await db.cards.toArray(),
        cardPayments: await db.cardPayments.toArray(),
        goals: await db.goals.toArray(),
        contributions: await db.contributions.toArray(),
        closings: await db.closings.toArray()
      }
      download(`vanesa-respaldo-${month}.json`, JSON.stringify(backup, null, 2), 'application/json')
      setNotice('Copia de seguridad local exportada.')
    } catch (cause) {
      console.error('No se pudo exportar la copia de seguridad.', cause)
      setError('No se pudo crear el respaldo. Intenta de nuevo.')
    }
  }

  async function importBackup(file?: File) {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!validateImport(parsed)) throw new Error('El archivo no contiene un respaldo compatible.')
      if (!window.confirm('La restauración reemplazará los datos locales actuales. Primero exporta un respaldo si deseas conservarlos. ¿Continuar?')) return
      await db.transaction('rw', [db.movements, db.categories, db.cards, db.cardPayments, db.goals, db.contributions, db.closings], async () => {
        await db.movements.clear()
        await db.categories.clear()
        await db.cards.clear()
        await db.cardPayments.clear()
        await db.goals.clear()
        await db.contributions.clear()
        await db.closings.clear()
        if (parsed.movements.length) await db.movements.bulkPut(parsed.movements)
        if (parsed.categories.length) await db.categories.bulkPut(parsed.categories)
        if (parsed.cards.length) await db.cards.bulkPut(parsed.cards)
        if (parsed.cardPayments.length) await db.cardPayments.bulkPut(parsed.cardPayments)
        if (parsed.goals.length) await db.goals.bulkPut(parsed.goals)
        if (parsed.contributions.length) await db.contributions.bulkPut(parsed.contributions)
        if (parsed.closings.length) await db.closings.bulkPut(parsed.closings)
      })
      if (await db.categories.count() === 0 || await db.cards.count() === 0) await initializeDatabase()
      setNotice('Respaldo restaurado correctamente.')
    } catch (cause) {
      console.error('No se pudo importar el respaldo.', cause)
      setError(cause instanceof Error && cause.message.includes('respaldo') ? cause.message : 'No se pudo restaurar el archivo. Los datos no se reemplazaron.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function exportCsv() {
    try {
      const [movements, categories, cards] = await Promise.all([
        db.movements.orderBy('date').reverse().toArray(),
        db.categories.toArray(),
        db.cards.toArray()
      ])
      const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
      const rows = [
        ['Tipo', 'Descripción', 'Valor COP', 'Fecha', 'Categoría', 'Método', 'Tarjeta', 'Cuenta', 'Notas'].map(escape).join(','),
        ...movements.map(item => [
          item.type === 'income' ? 'Ingreso' : 'Gasto', item.description, item.amount, item.date,
          categories.find(category => category.id === item.categoryId)?.name ?? 'Categoría eliminada',
          item.paymentMethod, cards.find(card => card.id === item.cardId)?.name ?? '',
          item.account, item.notes
        ].map(escape).join(','))
      ]
      download(`vanesa-movimientos-${month}.csv`, `\ufeff${rows.join('\r\n')}`, 'text/csv;charset=utf-8')
      setNotice('Movimientos exportados a CSV.')
    } catch (cause) {
      console.error('No se pudieron exportar los movimientos.', cause)
      setError('No se pudo exportar el archivo CSV.')
    }
  }

  async function deleteAllData() {
    const confirmed = window.confirm('⚠️ Se eliminarán permanentemente movimientos, tarjetas, categorías, metas, aportes y cierres almacenados en este dispositivo. Esta acción no se puede deshacer. ¿Deseas continuar?')
    if (!confirmed) return
    try {
      await db.transaction('rw', [db.movements, db.categories, db.cards, db.cardPayments, db.goals, db.contributions, db.closings], async () => {
        await db.movements.clear()
        await db.categories.clear()
        await db.cards.clear()
        await db.cardPayments.clear()
        await db.goals.clear()
        await db.contributions.clear()
        await db.closings.clear()
      })
      await initializeDatabase()
      setNotice('Datos financieros borrados. Se conservaron preferencias de la aplicación.')
    } catch (cause) {
      console.error('No se pudieron borrar los datos.', cause)
      setError('No se pudo completar el borrado.')
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); setSection('dashboard') }}><span className="brand-mark">V</span><span><strong>vanesa</strong><small>FINANZAS PERSONALES</small></span></a>
      <div className="private-badge"><ShieldCheck size={15} /> Tus datos, solo aquí</div>
      <nav className="nav-list" aria-label="Navegación principal">{['Principal', 'Gestión', 'Análisis', 'Ajustes'].map(group => <div className="nav-group" key={group}><span className="nav-group-title">{group}</span>{navigation.filter(item => item.group === group).map(item => {
        const Icon = item.icon
        return <button key={item.id} className={`nav-item ${section === item.id ? 'selected' : ''}`} onClick={() => setSection(item.id)}><Icon size={18} strokeWidth={1.8} /><span>{item.label}</span></button>
      })}</div>)}</nav>
      <div className="sidebar-bottom"><div className={`connection-status ${online ? 'is-online' : 'is-offline'}`}>{online ? <Wifi size={16} /> : <WifiOff size={16} />}<span>{online ? 'Aplicación lista' : 'Modo sin conexión'}</span></div><p>Almacenamiento local · IndexedDB</p></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark small-mark">V</span><strong>vanesa</strong></div><div className="page-title"><span className="eyebrow">{section === 'dashboard' ? 'TU RESUMEN FINANCIERO' : 'GESTIÓN PERSONAL'}</span><h1>{sectionTitles[section]}</h1></div><div className="topbar-actions"><div className={`online-pill ${online ? 'is-online' : 'is-offline'}`}>{online ? <Wifi size={14} /> : <WifiOff size={14} />}<span>{online ? 'En línea' : 'Sin conexión'}</span></div><button className="icon-button theme-toggle" aria-label="Cambiar tema" onClick={() => void toggleTheme()}>{settings?.theme === 'dark' ? '☀' : '☾'}</button><button className="button button-primary top-add" onClick={() => setSection('movements')}><Plus size={17} /> Nuevo movimiento</button><button className="install-button" onClick={() => void installApp()}><Smartphone size={17} /><span>Instalar</span></button></div></header>
      {!databaseReady ? <section className="panel loading-panel"><div className="loading-spinner" /><p>Preparando almacenamiento seguro...</p></section> : <>
        {error && <div className="app-alert error-alert" role="alert"><CircleHelp size={17} />{error}<button onClick={() => setError('')} aria-label="Cerrar"><X size={15} /></button></div>}
        {notice && <div className="app-alert success-alert" role="status"><ShieldCheck size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Cerrar"><X size={15} /></button></div>}
        <div className="page-title-mobile"><span className="eyebrow">{section === 'dashboard' ? 'TU RESUMEN FINANCIERO' : 'GESTIÓN PERSONAL'}</span><h1>{sectionTitles[section]}</h1></div>
        <Suspense fallback={<section className="panel loading-panel"><div className="loading-spinner" /><p>Preparando sección...</p></section>}>
          {section === 'dashboard' && <DashboardPage month={month} onMonthChange={setMonth} />}
          {section === 'movements' && <MovementsPage />}
          {section === 'categories' && <CategoriesPage />}
          {section === 'cards' && <CardsPage />}
          {section === 'analytics' && <AnalyticsPage />}
          {section === 'closings' && <ClosingsPage month={month} />}
          {section === 'goals' && <GoalsPage />}
        </Suspense>
        {section === 'settings' && <SettingsPage onExport={exportBackup} onImport={() => fileInput.current?.click()} onCsv={exportCsv} onDelete={() => void deleteAllData()} onNotice={setNotice} />}
        <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={event => void importBackup(event.target.files?.[0])} />
      </>}
    </main>
    {mobileMoreOpen && <div className="mobile-more-menu">{navigation.filter(item => ['categories', 'closings', 'goals'].includes(item.id)).map(item => {
      const Icon = item.icon
      return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => { setSection(item.id); setMobileMoreOpen(false) }}><Icon size={16} />{item.label}</button>
    })}</div>}
    <nav className="mobile-nav" aria-label="Navegación móvil">{navigation.filter(item => ['dashboard', 'movements', 'cards', 'analytics'].includes(item.id)).map(item => {
      const Icon = item.icon
      return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => { setSection(item.id); setMobileMoreOpen(false) }}><Icon size={18} /><span>{item.id === 'dashboard' ? 'Inicio' : item.id === 'movements' ? 'Movimientos' : item.id === 'analytics' ? 'Análisis' : 'Tarjetas'}</span></button>
    })}<button className={mobileMoreOpen || ['categories', 'closings', 'goals', 'settings'].includes(section) ? 'active' : ''} onClick={() => setMobileMoreOpen(!mobileMoreOpen)}><MoreHorizontal size={19} /><span>Más</span></button></nav>
    {installHelp && <div className="modal-backdrop" onClick={() => setInstallHelp(false)}><div className="install-modal panel" onClick={event => event.stopPropagation()}><button className="modal-close icon-button" onClick={() => setInstallHelp(false)} aria-label="Cerrar"><X size={18} /></button><span className="brand-mark">V</span><h2>Instala Vanesa</h2><p>En iPhone o iPad: abre esta página en Safari, toca <strong>Compartir</strong> y selecciona <strong>Añadir a pantalla de inicio</strong>.</p><p>En Android o escritorio: abre el menú del navegador y elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</p><p className="muted small">La instalación requiere que la aplicación esté publicada bajo HTTPS. En desarrollo, localhost es válido.</p><button className="button button-primary" onClick={() => setInstallHelp(false)}>Entendido</button></div></div>}
    <footer className="privacy-footer"><ShieldCheck size={14} /> Sin cuentas, sin nube, sin conexiones bancarias. Tus finanzas permanecen en este dispositivo.</footer>
  </div>
}

function SettingsPage({ onExport, onImport, onCsv, onDelete, onNotice }: {
  onExport: () => void
  onImport: () => void
  onCsv: () => void
  onDelete: () => void
  onNotice: (text: string) => void
}) {
  const settings = useLiveQuery(() => db.settings.get('preferences'), [])
  const [installInfo, setInstallInfo] = useState(false)
  return <div className="page-stack">
    <section className="panel"><div className="panel-heading"><div><h2>Privacidad y almacenamiento</h2><p>La información se almacena en IndexedDB de este navegador. No se envía a servidores.</p></div><ShieldCheck size={22} className="positive" /></div>
      <div className="privacy-points"><div><ShieldCheck size={17} /><span>Los movimientos y respaldos permanecen en tu dispositivo.</span></div><div><WifiOff size={17} /><span>Sin inicio de sesión ni conexiones bancarias automáticas.</span></div><div><FolderOpen size={17} /><span>Exporta copias JSON periódicamente para conservar tus datos.</span></div></div>
      <div className="warning-box"><strong>Importante:</strong> borrar los datos del navegador, restablecerlo o desinstalar la aplicación puede ocasionar pérdida de información local. Exporta un respaldo y guárdalo de forma segura fuera del navegador.</div>
      <div className="backup-actions"><button className="button button-primary" onClick={onExport}><Download size={16} /> Exportar respaldo JSON</button><button className="button button-quiet" onClick={onImport}><FolderOpen size={16} /> Restaurar respaldo</button><button className="button button-quiet" onClick={onCsv}><Download size={16} /> Exportar movimientos CSV</button></div>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Preferencias</h2><p>Configuración regional fija para Colombia.</p></div></div><div className="settings-facts"><div><span>Idioma</span><strong>Español (Colombia)</strong></div><div><span>País</span><strong>Colombia</strong></div><div><span>Moneda</span><strong>COP · peso colombiano</strong></div><div><span>Zona horaria</span><strong>America/Bogota</strong></div><div><span>Formato</span><strong>$1.500.000 · DD/MM/AAAA</strong></div><div><span>Almacenamiento</span><strong>{settings ? 'IndexedDB local' : 'Preparando'}</strong></div></div>
    <button className="text-button install-link" onClick={() => setInstallInfo(!installInfo)}><Smartphone size={16} /> Cómo instalar en celular</button>{installInfo && <div className="install-instructions"><p><strong>Android:</strong> abre la app desde Chrome, toca el menú ⋮ y elige Instalar aplicación.</p><p><strong>iPhone:</strong> abre en Safari, toca Compartir y selecciona Añadir a pantalla de inicio.</p><p>La instalación requiere HTTPS en producción. La PWA almacena sus recursos para permitir acceso offline.</p></div>}</section>
    <section className="panel danger-panel"><div className="panel-heading"><div><h2>Eliminar información local</h2><p>Esta acción elimina movimientos, tarjetas, categorías personalizadas, metas, aportes y cierres.</p></div></div><div className="warning-box">La aplicación mantiene categorías y tarjetas iniciales para volver a usarla. Se solicitará confirmación explícita antes de borrar.</div><button className="button button-danger" onClick={() => { onNotice(''); onDelete() }}><Trash2 size={16} /> Borrar los datos de este dispositivo</button></section>
  </div>
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
