import { useEffect, useMemo, useState } from 'react'
import { BarChart3, LineChart, AreaChart, ScatterChart, PieChart, Table2, Hash, X, Plus, Trash2, Database, Check } from 'lucide-react'
import { api } from '../../lib/api.js'
import WidgetChart from './WidgetChart.jsx'
import { Alert, Spinner } from '../ui.jsx'

export const CHART_TYPES = [
  { key: 'stat', label: 'Stat card', icon: Hash, hint: 'One headline number', dims: [0, 0], measures: [1, 3] },
  { key: 'bar', label: 'Bar', icon: BarChart3, hint: 'Compare categories', dims: [1, 2], measures: [1, 6] },
  { key: 'line', label: 'Line', icon: LineChart, hint: 'Trend over time', dims: [1, 2], measures: [1, 6] },
  { key: 'area', label: 'Area', icon: AreaChart, hint: 'Trend with volume', dims: [1, 2], measures: [1, 6] },
  { key: 'scatter', label: 'Scatter', icon: ScatterChart, hint: 'Relation of two values', dims: [1, 2], measures: [2, 2] },
  { key: 'pie', label: 'Donut', icon: PieChart, hint: 'Share of a total', dims: [1, 1], measures: [1, 1] },
  { key: 'table', label: 'Table', icon: Table2, hint: 'Rows and columns', dims: [0, 2], measures: [1, 6] },
]
export const TYPE_BY_KEY = Object.fromEntries(CHART_TYPES.map((c) => [c.key, c]))

export const RANGE_LABEL = {
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  LAST_7_DAYS: 'Last 7 days',
  LAST_30_DAYS: 'Last 30 days',
  THIS_MONTH: 'This month',
  LAST_MONTH: 'Last month',
  THIS_YEAR: 'This year',
  LAST_12_MONTHS: 'Last 12 months',
  CUSTOM: 'Custom dates',
}
const AGG_LABEL = { SUM: 'Sum', AVG: 'Average', MIN: 'Minimum', MAX: 'Maximum', COUNT: 'Count' }

export function newWidget() {
  return {
    id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: '',
    type: 'bar',
    size: 2,
    stacked: false,
    query: {
      dataset: 'production',
      dimensions: [{ key: 'machine' }],
      measures: [{ key: 'production_kg', agg: 'SUM' }],
      filters: { range: 'LAST_7_DAYS', machineIds: [], shifts: [] },
      limit: 50,
    },
  }
}

export function autoTitle(w, catalog) {
  const ds = catalog?.datasets.find((d) => d.key === w.query.dataset)
  if (!ds) return 'Untitled widget'
  const ms = w.query.measures.map((m) => ds.measures.find((x) => x.key === m.key)?.label).filter(Boolean)
  const ds0 = w.query.dimensions[0] && ds.dimensions.find((x) => x.key === w.query.dimensions[0].key)
  const ds1 = w.query.dimensions[1] && ds.dimensions.find((x) => x.key === w.query.dimensions[1].key)
  let t = ms.join(' & ') || ds.label
  if (ds0) t += ` by ${ds0.label.toLowerCase()}`
  if (ds1) t += ` and ${ds1.label.toLowerCase()}`
  return t
}

/** Returns a readable problem with the widget's shape, or null when it can run. */
export function validate(w) {
  const rule = TYPE_BY_KEY[w.type]
  const d = w.query.dimensions.length
  const m = w.query.measures.length
  if (d < rule.dims[0]) return `${rule.label} needs a "Group by" column`
  if (d > rule.dims[1]) return `${rule.label} supports at most ${rule.dims[1]} group-by column${rule.dims[1] === 1 ? '' : 's'}`
  if (m < rule.measures[0]) return rule.key === 'scatter' ? 'Scatter needs two values: X and Y' : 'Pick at least one value'
  if (m > rule.measures[1]) return `${rule.label} supports at most ${rule.measures[1]} value${rule.measures[1] === 1 ? '' : 's'}`
  if (w.query.filters.range === 'CUSTOM' && (!w.query.filters.from || !w.query.filters.to)) return 'Choose custom from and to dates'
  return null
}

/** Cleans a widget's query for the API (drops grains on non-time columns, etc.). */
export function toRequest(w) {
  const q = w.query
  return {
    dataset: q.dataset,
    dimensions: q.dimensions,
    measures: q.measures,
    filters: q.filters,
    limit: q.limit,
    sortBy: q.sortBy || undefined,
    sortDir: q.sortDir || undefined,
  }
}

function Step({ n, title, children, hint }) {
  return (
    <section className="py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="num text-[11px] font-bold text-brand-600 dark:text-brand-300">0{n}</span>
        <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
        {hint && <span className="text-xs text-gray-400 truncate">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

export default function WidgetBuilder({ catalog, machines, initial, onCancel, onSave }) {
  const [w, setW] = useState(() => structuredClone(initial || newWidget()))
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ds = catalog.datasets.find((d) => d.key === w.query.dataset)
  const rule = TYPE_BY_KEY[w.type]
  const problem = validate(w)

  const setQuery = (patch) => setW((x) => ({ ...x, query: { ...x.query, ...patch } }))
  const setFilters = (patch) => setW((x) => ({ ...x, query: { ...x.query, filters: { ...x.query.filters, ...patch } } }))

  // Keep columns within what the chosen visual can show.
  const chooseType = (key) => {
    const r = TYPE_BY_KEY[key]
    setW((x) => {
      let dims = x.query.dimensions.slice(0, r.dims[1])
      if (dims.length < r.dims[0]) dims = [{ key: ds.dimensions[0].key, grain: ds.dimensions[0].temporal ? 'day' : undefined }]
      let measures = x.query.measures.slice(0, r.measures[1])
      while (measures.length < r.measures[0]) {
        const next = ds.measures.find((m) => !measures.some((y) => y.key === m.key))
        measures = [...measures, { key: next.key, agg: next.calculated ? undefined : next.defaultAgg }]
      }
      if (dims.length === 2 && key !== 'table' && key !== 'scatter') measures = measures.slice(0, 1)
      return { ...x, type: key, size: key === 'stat' ? 1 : x.size, query: { ...x.query, dimensions: dims, measures } }
    })
  }

  const chooseDataset = (key) => {
    const d = catalog.datasets.find((x) => x.key === key)
    const firstMeasure = d.measures[0]
    const firstDim = d.dimensions.find((x) => !x.temporal) || d.dimensions[0]
    setW((x) => ({
      ...x,
      query: {
        ...x.query,
        dataset: key,
        dimensions: rule.dims[0] > 0 || x.query.dimensions.length ? [{ key: firstDim.key, grain: firstDim.temporal ? 'day' : undefined }] : [],
        measures: rule.key === 'scatter'
          ? d.measures.slice(0, 2).map((m) => ({ key: m.key, agg: m.calculated ? undefined : m.defaultAgg }))
          : [{ key: firstMeasure.key, agg: firstMeasure.calculated ? undefined : firstMeasure.defaultAgg }],
        filters: { ...x.query.filters, shifts: d.hasShift ? x.query.filters.shifts : [] },
      },
    }))
  }

  const setDim = (i, key) => {
    const dims = [...w.query.dimensions]
    if (!key) dims.splice(i, 1)
    else {
      const def = ds.dimensions.find((x) => x.key === key)
      dims[i] = { key, grain: def.temporal ? dims[i]?.grain || 'day' : undefined }
    }
    let measures = w.query.measures
    if (dims.length === 2 && w.type !== 'table' && w.type !== 'scatter') measures = measures.slice(0, 1)
    setQuery({ dimensions: dims, measures })
  }

  const request = useMemo(() => JSON.stringify(toRequest(w)), [w])

  useEffect(() => {
    if (problem) {
      setResult(null)
      return undefined
    }
    let alive = true
    setLoading(true)
    const id = setTimeout(() => {
      api('/query', { method: 'POST', body: JSON.parse(request) })
        .then((r) => {
          if (alive) {
            setResult(r)
            setError('')
          }
        })
        .catch((e) => alive && setError(e.message))
        .finally(() => alive && setLoading(false))
    }, 350)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [request, problem])

  const splitAllowed = rule.dims[1] >= 2
  const singleValueOnly = w.query.dimensions.length === 2 && w.type !== 'table' && w.type !== 'scatter'
  const maxMeasures = singleValueOnly ? 1 : rule.measures[1]
  const title = w.title || autoTitle(w, catalog)

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-label="Widget builder">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-7xl h-full sm:h-[90vh] bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="eyebrow">{initial ? 'Edit widget' : 'New widget'}</div>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Widget builder</h2>
          </div>
          <button onClick={onCancel} className="btn-ghost !p-2" aria-label="Close builder"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_1fr]">
          <div className="overflow-y-auto px-6 border-r border-gray-100 dark:border-gray-800">
            <Step n={1} title="Pick a visual">
              <div className="grid grid-cols-4 gap-2">
                {CHART_TYPES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => chooseType(key)}
                    aria-pressed={w.type === key}
                    className={`rounded-xl border px-2 py-3 flex flex-col items-center gap-1.5 transition ${w.type === key ? 'border-brand-500 bg-brand-500/5 ring-4 ring-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] font-bold">{label}</span>
                  </button>
                ))}
              </div>
              <p className="form-hint">{rule.hint}</p>
            </Step>

            <Step n={2} title="Choose a data table" hint="each table lists its columns">
              <div className="space-y-2">
                {catalog.datasets.map((d, i) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => chooseDataset(d.key)}
                    aria-pressed={w.query.dataset === d.key}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${w.query.dataset === d.key ? 'border-brand-500 bg-brand-500/5 ring-4 ring-brand-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">Table {i + 1} · {d.label}</span>
                      {w.query.dataset === d.key && <Check className="w-4 h-4 text-brand-600 ml-auto" />}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.description}</p>
                    {w.query.dataset === d.key && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          <span className="eyebrow mr-1 self-center">Columns</span>
                          {d.dimensions.map((x) => <span key={x.key} className="chip bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 !font-medium">{x.label}</span>)}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="eyebrow mr-1 self-center">Values</span>
                          {d.measures.map((x) => <span key={x.key} className="chip bg-brand-500/10 text-brand-700 dark:text-brand-300 !font-medium">{x.label}</span>)}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </Step>

            <Step n={3} title="Columns & calculation">
              {rule.dims[1] > 0 && (
                <div className="space-y-3 mb-4">
                  {[0, 1].slice(0, splitAllowed ? 2 : 1).map((i) => {
                    const dim = w.query.dimensions[i]
                    const def = dim && ds.dimensions.find((x) => x.key === dim.key)
                    const canBeEmpty = i === 1 || rule.dims[0] === 0
                    if (i === 1 && !w.query.dimensions[0]) return null
                    return (
                      <div key={i}>
                        <label className="form-label">{i === 0 ? (w.type === 'table' ? 'Rows: group by' : w.type === 'pie' ? 'Slices: group by' : 'X axis: group by') : w.type === 'table' ? 'Then group by' : 'Split into series by'}</label>
                        <div className="flex gap-2">
                          <select className="form-select" value={dim?.key || ''} onChange={(e) => setDim(i, e.target.value)}>
                            {canBeEmpty && <option value="">{i === 1 ? 'No split' : 'No grouping (one row)'}</option>}
                            {ds.dimensions.filter((x) => x.key !== w.query.dimensions[1 - i]?.key).map((x) => (
                              <option key={x.key} value={x.key}>{x.label}</option>
                            ))}
                          </select>
                          {def?.temporal && (
                            <select
                              className="form-select !w-32"
                              value={dim.grain || 'day'}
                              onChange={(e) => {
                                const dims = [...w.query.dimensions]
                                dims[i] = { ...dims[i], grain: e.target.value }
                                setQuery({ dimensions: dims })
                              }}
                              aria-label="Time grain"
                            >
                              {catalog.grains.map((g) => <option key={g} value={g}>per {g}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <label className="form-label">{w.type === 'scatter' ? 'Values (first = X axis, second = Y axis)' : 'Values to calculate'}</label>
              <div className="space-y-2">
                {w.query.measures.map((m, i) => {
                  const def = ds.measures.find((x) => x.key === m.key)
                  return (
                    <div key={i} className="flex gap-2">
                      <select
                        className="form-select"
                        value={m.key}
                        onChange={(e) => {
                          const nd = ds.measures.find((x) => x.key === e.target.value)
                          const ms = [...w.query.measures]
                          ms[i] = { key: nd.key, agg: nd.calculated ? undefined : nd.defaultAgg }
                          setQuery({ measures: ms })
                        }}
                        aria-label={`Value ${i + 1}`}
                      >
                        {ds.measures.map((x) => <option key={x.key} value={x.key}>{x.label}{x.unit ? ` (${x.unit})` : ''}</option>)}
                      </select>
                      {def?.calculated ? (
                        <span className="chip bg-gray-100 dark:bg-gray-800 text-gray-500 !rounded-xl px-3 whitespace-nowrap" title="Calculated with weighting, not a simple aggregate">calculated</span>
                      ) : (
                        <select
                          className="form-select !w-32"
                          value={m.agg || def?.defaultAgg}
                          onChange={(e) => {
                            const ms = [...w.query.measures]
                            ms[i] = { ...ms[i], agg: e.target.value }
                            setQuery({ measures: ms })
                          }}
                          aria-label="Aggregation"
                        >
                          {catalog.aggregations.map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
                        </select>
                      )}
                      {w.query.measures.length > rule.measures[0] && (
                        <button type="button" className="text-gray-400 hover:text-red-500 px-1" onClick={() => setQuery({ measures: w.query.measures.filter((_, j) => j !== i) })} aria-label="Remove value">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {w.query.measures.length < maxMeasures && (
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-brand-600 inline-flex items-center gap-1"
                  onClick={() => {
                    const next = ds.measures.find((x) => !w.query.measures.some((m) => m.key === x.key)) || ds.measures[0]
                    setQuery({ measures: [...w.query.measures, { key: next.key, agg: next.calculated ? undefined : next.defaultAgg }] })
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add value
                </button>
              )}
              {singleValueOnly && <p className="form-hint">With a series split, one value is plotted per series.</p>}
            </Step>

            <Step n={4} title="Filters">
              <div className="grid grid-cols-2 gap-3">
                {ds.hasDate ? (
                  <label className="col-span-2">
                    <span className="form-label">Date range</span>
                    <select className="form-select" value={w.query.filters.range} onChange={(e) => setFilters({ range: e.target.value })}>
                      {catalog.ranges.map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
                    </select>
                  </label>
                ) : (
                  <p className="col-span-2 text-xs text-gray-500">This table has no dates; it always shows the current master data.</p>
                )}
                {ds.hasDate && w.query.filters.range === 'CUSTOM' && (
                  <>
                    <label><span className="form-label">From</span><input type="date" className="form-input" value={w.query.filters.from || ''} onChange={(e) => setFilters({ from: e.target.value })} /></label>
                    <label><span className="form-label">To</span><input type="date" className="form-input" value={w.query.filters.to || ''} onChange={(e) => setFilters({ to: e.target.value })} /></label>
                  </>
                )}
              </div>
              {ds.hasShift && (
                <div className="mt-3">
                  <span className="form-label">Shifts</span>
                  <div className="flex gap-2">
                    {['A', 'B', 'C'].map((s) => {
                      const on = w.query.filters.shifts?.includes(s)
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setFilters({ shifts: on ? w.query.filters.shifts.filter((x) => x !== s) : [...(w.query.filters.shifts || []), s] })}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${on ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
                        >
                          Shift {s}
                        </button>
                      )
                    })}
                    <span className="text-xs text-gray-400 self-center">{w.query.filters.shifts?.length ? '' : 'all shifts'}</span>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <span className="form-label">Machines {w.query.filters.machineIds?.length ? `(${w.query.filters.machineIds.length})` : '(all)'}</span>
                <div className="flex flex-wrap gap-1.5">
                  {machines.map((m) => {
                    const on = w.query.filters.machineIds?.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setFilters({ machineIds: on ? w.query.filters.machineIds.filter((x) => x !== m.id) : [...(w.query.filters.machineIds || []), m.id] })}
                        className={`num px-2 py-1 rounded-md text-xs font-semibold border ${on ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
                      >
                        {m.code}
                      </button>
                    )
                  })}
                </div>
              </div>
              {w.type !== 'stat' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <label>
                    <span className="form-label">Sort</span>
                    <select
                      className="form-select"
                      value={`${w.query.sortBy || ''}|${w.query.sortDir || ''}`}
                      onChange={(e) => {
                        const [sortBy, sortDir] = e.target.value.split('|')
                        setQuery({ sortBy: sortBy || undefined, sortDir: sortDir || undefined })
                      }}
                    >
                      <option value="|">Automatic</option>
                      <option value="m0|desc">Highest value first</option>
                      <option value="m0|asc">Lowest value first</option>
                      <option value="d0|asc">By label A→Z / oldest first</option>
                      <option value="d0|desc">By label Z→A / newest first</option>
                    </select>
                  </label>
                  <label>
                    <span className="form-label">Max rows</span>
                    <input type="number" min="1" max="2000" className="form-input num" value={w.query.limit || 50} onChange={(e) => setQuery({ limit: Number(e.target.value) })} />
                  </label>
                </div>
              )}
            </Step>

            <Step n={5} title="Title & size">
              <input className="form-input" value={w.title} placeholder={autoTitle(w, catalog)} onChange={(e) => setW({ ...w, title: e.target.value })} aria-label="Widget title" />
              <div className="flex items-center gap-2 mt-3">
                {[[1, 'Small · ⅓'], [2, 'Medium · ⅔'], [3, 'Wide · full']].map(([s, label]) => (
                  <button key={s} type="button" aria-pressed={w.size === s} onClick={() => setW({ ...w, size: s })} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border ${w.size === s ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {(w.type === 'bar' || w.type === 'area') && (
                <label className="flex items-center gap-2 mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input type="checkbox" className="rounded" checked={!!w.stacked} onChange={(e) => setW({ ...w, stacked: e.target.checked })} /> Stack series
                </label>
              )}
            </Step>
          </div>

          <div className="flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950/50 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow">Live preview</span>
              {loading && <Spinner className="text-brand-500" />}
            </div>
            <div className="card flex-1 min-h-[320px] flex flex-col">
              <div className="card-header">
                <div className="min-w-0">
                  <h3 className="card-title truncate">{title}</h3>
                  <p className="text-xs text-gray-400 truncate">{ds.label} · {ds.hasDate ? RANGE_LABEL[w.query.filters.range] : 'master data'}</p>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-4">
                {problem ? <Alert>{problem}</Alert> : error ? <Alert>{error}</Alert> : <WidgetChart type={w.type} result={result} stacked={w.stacked} />}
              </div>
            </div>
            {result && !problem && (
              <p className="text-xs text-gray-400 mt-2">
                {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
                {result.from && <> · <span className="num">{result.from} → {result.to}</span></>}
                {result.truncated && ' · limited, raise "Max rows" to see more'}
              </p>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-brand" disabled={!!problem} onClick={() => onSave({ ...w, title: w.title || autoTitle(w, catalog) })}>
            <Check className="w-4 h-4" /> {initial ? 'Update widget' : 'Add to dashboard'}
          </button>
        </footer>
      </div>
    </div>
  )
}
