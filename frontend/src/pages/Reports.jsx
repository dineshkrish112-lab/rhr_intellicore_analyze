import { useCallback, useEffect, useState } from 'react'
import { FileText, FileSpreadsheet, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { api, download } from '../lib/api.js'
import { fmt1, fmt2, isoDate } from '../lib/format.js'
import { Alert, Empty, PageTitle, Pagination, Segmented, Spinner } from '../components/ui.jsx'
import { useChartTheme } from '../charts/chartTheme.js'

const now = new Date()
const thisYear = now.getFullYear()
const thisMonth = `${thisYear}-${String(now.getMonth() + 1).padStart(2, '0')}`

const DEFAULT_RANGE = {
  DAY: { from: isoDate(new Date(thisYear, now.getMonth(), 1)), to: isoDate(now) },
  MONTH: { from: `${thisYear}-01`, to: thisMonth },
  YEAR: { from: String(thisYear - 1), to: String(thisYear) },
}
const YEARS = Array.from({ length: 8 }, (_, i) => String(thisYear - i))

const COLUMNS = [
  { key: 'period', label: 'Period', sort: 'period' },
  { key: 'machineCode', label: 'Machine', sort: 'machine' },
  { key: 'machineType', label: 'Type' },
  { key: 'shiftCode', label: 'Shift', sort: 'shift' },
  { key: 'productionKg', label: 'Production (kg)', num: fmt1, sort: 'production' },
  { key: 'targetKg', label: 'Target (kg)', num: fmt1 },
  { key: 'achievement', label: 'Achv %', num: fmt1 },
  { key: 'rejectKg', label: 'Reject (kg)', num: fmt1 },
  { key: 'avgSpeed', label: 'Avg speed', num: (v) => (v ? fmt1(v) : '–') },
  { key: 'avgCv', label: 'CV %', num: (v) => (v ? fmt2(v) : '–') },
  { key: 'avgTemperature', label: 'Temp °C', num: fmt1 },
  { key: 'avgHumidity', label: 'RH %', num: fmt1 },
  { key: 'energyKwh', label: 'Energy (kWh)', num: fmt1 },
  { key: 'runHours', label: 'Run h', num: fmt1 },
  { key: 'downHours', label: 'Down h', num: fmt1 },
  { key: 'stoppages', label: 'Stops', num: (v) => v },
  { key: 'availability', label: 'Avail %', num: fmt1 },
  { key: 'performance', label: 'Perf %', num: fmt1 },
  { key: 'quality', label: 'Quality %', num: fmt1 },
  { key: 'oee', label: 'OEE %', num: fmt1, sort: 'oee' },
]

function RangeInputs({ granularity, range, setRange }) {
  const set = (k) => (e) => setRange({ ...range, [k]: e.target.value })
  if (granularity === 'YEAR') {
    return (
      <>
        <div>
          <label className="form-label" htmlFor="from">From year</label>
          <select id="from" className="form-select" value={range.from} onChange={set('from')}>
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="to">To year</label>
          <select id="to" className="form-select" value={range.to} onChange={set('to')}>
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
      </>
    )
  }
  const type = granularity === 'MONTH' ? 'month' : 'date'
  const max = granularity === 'MONTH' ? thisMonth : isoDate(now)
  return (
    <>
      <div>
        <label className="form-label" htmlFor="from">From {type}</label>
        <input id="from" type={type} className="form-input" value={range.from} max={range.to || max} onChange={set('from')} required />
      </div>
      <div>
        <label className="form-label" htmlFor="to">To {type}</label>
        <input id="to" type={type} className="form-input" value={range.to} min={range.from} max={max} onChange={set('to')} required />
      </div>
    </>
  )
}

export default function Reports() {
  const t = useChartTheme()
  const [granularity, setGranularity] = useState('DAY')
  const [range, setRange] = useState(DEFAULT_RANGE.DAY)
  const [machineId, setMachineId] = useState('')
  const [shift, setShift] = useState('ALL')
  const [machines, setMachines] = useState([])
  const [query, setQuery] = useState(null)
  const [sort, setSort] = useState({ field: 'period', direction: 'desc' })
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api('/machines').then(setMachines).catch(() => {})
  }, [])

  const filters = useCallback(
    () => ({ granularity, from: range.from, to: range.to, machineId: machineId || undefined, shift }),
    [granularity, range, machineId, shift],
  )

  const apply = (e) => {
    e?.preventDefault()
    setPage(0)
    setQuery(filters())
  }

  // Generate the default report once on first visit.
  useEffect(() => {
    setQuery(filters())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!query) return
    let alive = true
    setLoading(true)
    api('/reports', { params: { ...query, sort: sort.field, direction: sort.direction, page, size } })
      .then((d) => {
        if (alive) {
          setData(d)
          setError('')
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [query, sort, page, size])

  const changeGranularity = (g) => {
    setGranularity(g)
    setRange(DEFAULT_RANGE[g])
  }

  const exportFile = async (format) => {
    const q = query || filters()
    setExporting(format)
    setError('')
    try {
      await download('/reports/export', { ...q, format, sort: sort.field, direction: sort.direction }, `production-report.${format}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setExporting('')
    }
  }

  const toggleSort = (field) => {
    setPage(0)
    setSort((s) => (s.field === field ? { field, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: field === 'period' ? 'desc' : 'asc' }))
  }

  return (
    <>
      <PageTitle title="Production Reports" subtitle="Shift-wise production register by day, month or year">
        <button className="btn-outline" onClick={() => exportFile('pdf')} disabled={!!exporting}>
          {exporting === 'pdf' ? <Spinner /> : <FileText className="w-4 h-4 text-red-500" />} Download PDF
        </button>
        <button className="btn-outline" onClick={() => exportFile('xlsx')} disabled={!!exporting}>
          {exporting === 'xlsx' ? <Spinner /> : <FileSpreadsheet className="w-4 h-4 text-green-600" />} Download Excel
        </button>
      </PageTitle>

      <form onSubmit={apply} className="card p-5 mb-6">
        <div className="mb-4">
          <Segmented
            label="Report period"
            value={granularity}
            onChange={changeGranularity}
            options={[
              { value: 'DAY', label: 'Date wise' },
              { value: 'MONTH', label: 'Month wise' },
              { value: 'YEAR', label: 'Year wise' },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <RangeInputs granularity={granularity} range={range} setRange={setRange} />
          <div>
            <label className="form-label" htmlFor="machine">Machine</label>
            <select id="machine" className="form-select" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
              <option value="">All machines</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} · {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="shift">Shift</label>
            <select id="shift" className="form-select" value={shift} onChange={(e) => setShift(e.target.value)}>
              <option value="ALL">All shifts</option>
              <option value="A">Shift A</option>
              <option value="B">Shift B</option>
              <option value="C">Shift C</option>
            </select>
          </div>
          <button type="submit" className="btn-brand sm:col-span-2 lg:col-span-1" disabled={loading}>
            {loading ? <Spinner /> : <Filter className="w-4 h-4" />} Generate report
          </button>
        </div>
      </form>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {data?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
          {[
            ['Production', `${fmt1(data.totals.productionKg / 1000)} t`],
            ['Achievement', `${fmt1(data.totals.achievement)}%`],
            ['OEE', `${fmt1(data.totals.oee)}%`],
            ['Availability', `${fmt1(data.totals.availability)}%`],
            ['Rejects', `${fmt1(data.totals.rejectKg)} kg`],
            ['Energy', `${fmt1(data.totals.energyKwh / 1000)} MWh`],
          ].map(([k, v]) => (
            <div key={k} className="card px-4 py-3">
              <div className="text-[11px] uppercase font-semibold text-gray-400 dark:text-gray-500">{k}</div>
              <div className="text-xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <header className="card-header">
          <h2 className="card-title">
            Report rows <span className="text-gray-400 font-medium">{data ? data.totalElements.toLocaleString('en-IN') : ''}</span>
          </h2>
          {loading && <Spinner className="text-brand-500" />}
        </header>
        <div className="overflow-x-auto">
          <table className="table-auto w-full text-sm">
            <thead className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-b border-gray-100 dark:border-gray-700/60">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className={`px-3 py-3 whitespace-nowrap ${c.num ? 'text-right' : 'text-left'}`}>
                    {c.sort ? (
                      <button type="button" onClick={() => toggleSort(c.sort)} className="inline-flex items-center gap-1 uppercase hover:text-gray-800 dark:hover:text-gray-200">
                        {c.label}
                        {sort.field === c.sort ? (
                          sort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {data?.content.map((r, i) => (
                <tr key={`${r.period}-${r.machineCode}-${r.shiftCode}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={`px-3 py-2.5 whitespace-nowrap ${c.num ? 'text-right tabular-nums' : ''} ${c.key === 'machineCode' ? 'font-semibold text-gray-800 dark:text-gray-100' : ''}`}>
                      {c.key === 'shiftCode' ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                          <span className="w-2 h-2 rounded-full" style={{ background: t.shift(r.shiftCode) }} /> {r.shiftCode}
                        </span>
                      ) : c.num ? (
                        c.num(r[c.key])
                      ) : (
                        r[c.key]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {data?.content.length > 0 && (
              <tfoot className="font-semibold text-gray-800 dark:text-gray-100 bg-brand-500/5 border-t-2 border-brand-200 dark:border-brand-500/30">
                <tr>
                  {COLUMNS.map((c, i) => (
                    <td key={c.key} className={`px-3 py-3 whitespace-nowrap ${c.num ? 'text-right tabular-nums' : ''}`}>
                      {i === 0 ? 'Total (all pages)' : c.num ? c.num(data.totals[c.key]) : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
          {data && data.content.length === 0 && <Empty>No production recorded for the selected filters</Empty>}
        </div>
        {data && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            totalElements={data.totalElements}
            size={size}
            onPage={setPage}
            onSize={(s) => {
              setSize(s)
              setPage(0)
            }}
          />
        )}
      </section>
    </>
  )
}
