import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Factory, LayoutGrid, Users, X, Save, Trash2 } from 'lucide-react'
import { api } from '../lib/api.js'
import { Alert, PageTitle, Spinner } from '../components/ui.jsx'
import OverviewBoard from '../components/OverviewBoard.jsx'
import CustomBoard from '../components/builder/CustomBoard.jsx'

function BoardDialog({ board, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({ name: board?.name || '', description: board?.description || '', shared: board?.shared || false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { ...form, widgets: board?.widgets || [] }
      const saved = board
        ? await api(`/dashboards/${board.id}`, { method: 'PUT', body })
        : await api('/dashboards', { method: 'POST', body })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete dashboard "${board.name}" and all its widgets?`)) return
    try {
      await api(`/dashboards/${board.id}`, { method: 'DELETE' })
      onDeleted(board)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={board ? 'Board settings' : 'New dashboard'}>
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative card w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">{board ? 'Board settings' : 'Create a dashboard'}</h2>
          <button type="button" onClick={onClose} className="btn-ghost !p-1.5" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {!board && <p className="text-sm text-gray-500 dark:text-gray-400">It appears as a new tab. Then add widgets: charts, stat cards or tables built from any data table.</p>}
        {error && <Alert>{error}</Alert>}
        <label className="block">
          <span className="form-label">Name</span>
          <input className="form-input" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ring frame quality" required autoFocus />
        </label>
        <label className="block">
          <span className="form-label">Description</span>
          <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this board for?" />
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3 cursor-pointer">
          <input type="checkbox" className="mt-1 rounded" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} />
          <span>
            <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">Share with everyone</span>
            <span className="block text-xs text-gray-500">Other users see it as a read-only tab.</span>
          </span>
        </label>
        <div className="flex items-center justify-between pt-2">
          {board ? <button type="button" className="btn-danger" onClick={remove}><Trash2 className="w-4 h-4" /> Delete</button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-brand" disabled={busy}>{busy ? <Spinner /> : <Save className="w-4 h-4" />} {board ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function Dashboard() {
  const [params, setParams] = useSearchParams()
  const active = params.get('board') || 'overview'
  const [boards, setBoards] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [machines, setMachines] = useState([])
  const [dialog, setDialog] = useState(null) // null | 'new' | board
  const [error, setError] = useState('')

  useEffect(() => {
    api('/dashboards').then(setBoards).catch((e) => setError(e.message))
    api('/query/catalog').then(setCatalog).catch(() => {})
    api('/machines').then(setMachines).catch(() => {})
  }, [])

  const open = (id) => setParams(id === 'overview' ? {} : { board: String(id) })
  const board = boards?.find((b) => String(b.id) === active)

  const saveBoard = useCallback(async (next) => {
    setBoards((list) => list.map((b) => (b.id === next.id ? next : b)))
    try {
      const saved = await api(`/dashboards/${next.id}`, {
        method: 'PUT',
        body: { name: next.name, description: next.description, shared: next.shared, widgets: next.widgets },
      })
      setBoards((list) => list.map((b) => (b.id === saved.id ? saved : b)))
      setError('')
    } catch (e) {
      setError(`Could not save: ${e.message}`)
    }
  }, [])

  const tab = (selected) =>
    `group flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition ${
      selected ? 'border-brand-500 text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
    }`

  return (
    <>
      <PageTitle
        title="Dashboards"
        subtitle="Plant Overview is the fixed shift-wise view. Create your own tabs and fill them with charts, stat cards and tables built from any data table."
      />

      <div className="flex items-end gap-1 border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto no-scrollbar">
        <button className={tab(active === 'overview')} onClick={() => open('overview')} role="tab" aria-selected={active === 'overview'}>
          <Factory className="w-4 h-4" /> Plant Overview
          <span className="chip bg-gray-100 dark:bg-gray-800 text-gray-500 !text-[10px]">fixed</span>
        </button>
        {boards?.map((b) => (
          <button key={b.id} className={tab(String(b.id) === active)} onClick={() => open(b.id)} role="tab" aria-selected={String(b.id) === active}>
            <LayoutGrid className="w-4 h-4" /> {b.name}
            {b.shared && <Users className="w-3.5 h-3.5 text-sky-500" aria-label="shared" />}
          </button>
        ))}
        <button className="ml-1 mb-1.5 btn-ghost !py-1.5 !px-3 text-brand-700 dark:text-brand-300" onClick={() => setDialog('new')}>
          <Plus className="w-4 h-4" /> New dashboard
        </button>
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {active === 'overview' ? (
        <OverviewBoard />
      ) : !boards || !catalog ? (
        <div className="card p-10 flex justify-center"><Spinner className="w-6 h-6 text-brand-500" /></div>
      ) : board ? (
        <CustomBoard board={board} catalog={catalog} machines={machines} onSave={saveBoard} onSettings={() => setDialog(board)} />
      ) : (
        <Alert>That dashboard no longer exists.</Alert>
      )}

      {dialog && (
        <BoardDialog
          board={dialog === 'new' ? null : dialog}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setBoards((list) => (list.some((b) => b.id === saved.id) ? list.map((b) => (b.id === saved.id ? saved : b)) : [...list, saved]))
            setDialog(null)
            open(saved.id)
          }}
          onDeleted={(b) => {
            setBoards((list) => list.filter((x) => x.id !== b.id))
            setDialog(null)
            open('overview')
          }}
        />
      )}
    </>
  )
}
