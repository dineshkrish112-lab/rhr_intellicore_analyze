import { useEffect, useRef, useState } from 'react'
import { Plus, MoreVertical, Pencil, Copy, Trash2, Maximize2, RefreshCw, Settings2, Users, Lock, LayoutGrid } from 'lucide-react'
import { api } from '../../lib/api.js'
import { SortableGrid, SortableItem } from '../Sortable.jsx'
import { Alert, Spinner } from '../ui.jsx'
import WidgetChart from './WidgetChart.jsx'
import WidgetBuilder, { RANGE_LABEL, TYPE_BY_KEY, toRequest } from './WidgetBuilder.jsx'

const SPAN = { 1: '', 2: 'xl:col-span-2', 3: 'xl:col-span-3' }

function WidgetMenu({ editable, onEdit, onDuplicate, onResize, onRemove }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  if (!editable) return null
  const item = 'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
  return (
    <div className="relative" ref={ref}>
      <button className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" onClick={() => setOpen((o) => !o)} aria-label="Widget options" aria-haspopup="true">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-44 card p-1.5" onClick={() => setOpen(false)}>
          <button className={item} onClick={onEdit}><Pencil className="w-4 h-4" /> Edit</button>
          <button className={item} onClick={onResize}><Maximize2 className="w-4 h-4" /> Change width</button>
          <button className={item} onClick={onDuplicate}><Copy className="w-4 h-4" /> Duplicate</button>
          <button className={`${item} !text-red-600`} onClick={onRemove}><Trash2 className="w-4 h-4" /> Remove</button>
        </div>
      )}
    </div>
  )
}

function WidgetCard({ widget, catalog, handle, editable, onEdit, onDuplicate, onResize, onRemove }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const ds = catalog.datasets.find((d) => d.key === widget.query.dataset)
  const key = JSON.stringify(toRequest(widget))

  const load = () => {
    setLoading(true)
    api('/query', { method: 'POST', body: JSON.parse(key) })
      .then((r) => {
        setResult(r)
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const Icon = TYPE_BY_KEY[widget.type]?.icon
  return (
    <section className="card h-full flex flex-col">
      <header className="flex items-start justify-between gap-2 px-5 pt-4 pb-2">
        <div className="min-w-0">
          <h3 className="card-title truncate flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0" />}
            {widget.title}
          </h3>
          <p className="text-xs text-gray-400 truncate">
            {ds?.label} · {ds?.hasDate ? RANGE_LABEL[widget.query.filters.range] : 'master data'}
            {widget.query.filters.shifts?.length ? ` · Shift ${widget.query.filters.shifts.join(', ')}` : ''}
            {widget.query.filters.machineIds?.length ? ` · ${widget.query.filters.machineIds.length} machine(s)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button className="p-1 rounded-md text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300" onClick={load} aria-label="Refresh widget">
            {loading ? <Spinner className="!w-3.5 !h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          <WidgetMenu editable={editable} onEdit={onEdit} onDuplicate={onDuplicate} onResize={onResize} onRemove={onRemove} />
          {editable && handle}
        </div>
      </header>
      <div className={`px-5 pb-4 ${widget.type === 'stat' ? 'h-32' : 'h-72'}`}>
        {error ? <Alert>{error}</Alert> : <WidgetChart type={widget.type} result={result} stacked={widget.stacked} />}
      </div>
    </section>
  )
}

export default function CustomBoard({ board, catalog, machines, onSave, onSettings }) {
  const [builder, setBuilder] = useState(null) // null | { widget?: existing }
  const widgets = board.widgets || []
  const editable = board.editable

  const save = (next) => onSave({ ...board, widgets: next })
  const upsert = (w) => {
    const exists = widgets.some((x) => x.id === w.id)
    save(exists ? widgets.map((x) => (x.id === w.id ? w : x)) : [...widgets, w])
    setBuilder(null)
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
          {board.shared ? (
            <span className="chip bg-sky-500/10 text-sky-700 dark:text-sky-300"><Users className="w-3.5 h-3.5" /> Shared with everyone</span>
          ) : (
            <span className="chip bg-gray-500/10 text-gray-600 dark:text-gray-300"><Lock className="w-3.5 h-3.5" /> Private</span>
          )}
          <span>{board.description ? board.description.replace(/\.?$/, '.') : 'Your own board.'} {editable ? 'Drag widgets by the grip to arrange them.' : `Owned by ${board.owner}, view only.`}</span>
        </div>
        {editable && (
          <div className="flex gap-2">
            <button className="btn-outline" onClick={onSettings}><Settings2 className="w-4 h-4" /> Board settings</button>
            <button className="btn-brand" onClick={() => setBuilder({})}><Plus className="w-4 h-4" /> Add widget</button>
          </div>
        )}
      </div>

      {widgets.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center mb-4">
            <LayoutGrid className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">This board is empty</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1">
            Add a widget: pick a visual (stat card, bar, line, scatter, donut or table), choose a data table and its columns,
            then decide how to calculate them (sum, average, count…).
          </p>
          {editable && (
            <button className="btn-brand mt-5" onClick={() => setBuilder({})}><Plus className="w-4 h-4" /> Add your first widget</button>
          )}
        </div>
      ) : (
        <SortableGrid
          ids={widgets.map((w) => w.id)}
          onReorder={(ids) => save(ids.map((id) => widgets.find((w) => w.id === id)))}
          className="grid grid-cols-1 xl:grid-cols-3 gap-4"
        >
          {widgets.map((w) => (
            <SortableItem key={w.id} id={w.id} className={SPAN[w.size] || ''}>
              {(handle) => (
                <WidgetCard
                  widget={w}
                  catalog={catalog}
                  handle={handle}
                  editable={editable}
                  onEdit={() => setBuilder({ widget: w })}
                  onDuplicate={() => save([...widgets, { ...structuredClone(w), id: `w${Date.now().toString(36)}`, title: `${w.title} (copy)` }])}
                  onResize={() => save(widgets.map((x) => (x.id === w.id ? { ...x, size: (x.size % 3) + 1 } : x)))}
                  onRemove={() => window.confirm(`Remove "${w.title}"?`) && save(widgets.filter((x) => x.id !== w.id))}
                />
              )}
            </SortableItem>
          ))}
        </SortableGrid>
      )}

      {builder && (
        <WidgetBuilder catalog={catalog} machines={machines} initial={builder.widget} onCancel={() => setBuilder(null)} onSave={upsert} />
      )}
    </>
  )
}
