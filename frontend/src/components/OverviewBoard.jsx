import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, RotateCcw, Zap, Clock, AlertTriangle, Cpu, Waves } from 'lucide-react'
import { api } from '../lib/api.js'
import { fmt0, fmt1, fmtKg, isoDate } from '../lib/format.js'
import { Segmented, Alert, Spinner } from './ui.jsx'
import { SortableGrid, SortableItem } from './Sortable.jsx'
import KpiGauge from '../charts/KpiGauge.jsx'
import { CvIndexHourly, HourlyProduction, MachineOee, MachineStatus, OeeTrend, ShiftProduction, SpeedCvScatter } from '../charts/DashboardCharts.jsx'
import { useLive } from '../context/LiveContext.jsx'

const KPIS = {
  oee: { title: 'OEE', subtitle: 'Availability × Performance × Quality', good: 85, fair: 65, info: 'Overall Equipment Effectiveness: the share of planned time that produced good yarn at full speed. 85% is considered world class.' },
  availability: { title: 'Availability', subtitle: 'Run time ÷ elapsed time', good: 90, fair: 80, info: 'How much of the elapsed shift time machines were actually running. Stoppages, doffing and faults pull this down.' },
  performance: { title: 'Performance', subtitle: 'Actual ÷ ideal output', good: 95, fair: 85, info: 'Output while running compared with the rated ideal rate. Running below rated speed pulls this down.' },
  quality: { title: 'Quality', subtitle: 'Good ÷ total output', good: 99, fair: 97, info: 'Share of output that was not rejected. High CV% (uneven yarn) increases rejects.' },
}

const WIDGETS = {
  hourly: { title: 'Hourly production', subtitle: 'kg produced per hour, all machines', span: 'xl:col-span-2', Chart: ({ d }) => <HourlyProduction hourly={d.hourly} /> },
  status: { title: 'Machine status', subtitle: 'Live state right now', span: '', Chart: ({ d }) => <MachineStatus counts={d.statusCounts} total={d.machineCount} /> },
  trend: { title: 'OEE trend', subtitle: 'Last 14 production days', span: 'xl:col-span-2', Chart: ({ d }) => <OeeTrend trend={d.trend} /> },
  shift: { title: 'Shift-wise production', subtitle: 'Coloured bar = produced, grey = shift target', span: '', Chart: ({ d }) => <ShiftProduction shiftWise={d.shiftWise} /> },
  scatter: { title: 'Speed vs CV%', subtitle: 'Each dot is one machine in one shift', span: 'xl:col-span-2', Chart: ({ d }) => <SpeedCvScatter scatter={d.scatter} /> },
  machine: { title: 'OEE by machine', subtitle: 'Ranked, selected period', span: '', Chart: ({ d }) => <MachineOee machineWise={d.machineWise} /> },
  cv: { title: 'Yarn evenness (CV index)', subtitle: '100 = every machine exactly on its CV% target', span: 'xl:col-span-3', Chart: ({ d }) => <CvIndexHourly hourly={d.hourly} /> },
}

const DEFAULT_LAYOUT = { kpis: Object.keys(KPIS), widgets: Object.keys(WIDGETS) }

/** Keeps saved order but drops unknown ids and appends widgets added since the layout was saved. */
function normalise(saved, defaults) {
  const known = (saved || []).filter((id) => defaults.includes(id))
  return [...known, ...defaults.filter((id) => !known.includes(id))]
}

function GlassTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl bg-white/[0.14] ring-1 ring-white/25 backdrop-blur-sm px-4 py-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/75">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="num text-xl font-semibold text-white mt-0.5 truncate">{value}</div>
      {hint && <div className="text-[11px] text-white/70 truncate">{hint}</div>}
    </div>
  )
}

/** Blue status band: the day's output against target plus the handful of numbers a manager checks first. */
function PlantPulse({ k, machines, activeAlarms, liveShift, selectedDate, isToday }) {
  const running = machines.filter((m) => m.status === 'RUNNING').length
  const pct = k.targetKg ? Math.min(100, (100 * k.productionKg) / k.targetKg) : 0
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-500 to-sky-400 text-white shadow-lift mb-5">
      <div className="absolute inset-0 bg-grid-white [mask-image:linear-gradient(90deg,transparent,black_40%)]" aria-hidden="true" />
      <div className="absolute -right-16 -top-24 w-80 h-80 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] gap-6 p-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
            <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-emerald-300 animate-pulse' : 'bg-white/60'}`} />
            {isToday && liveShift ? `${liveShift.shift.name} in progress` : 'Historical day'} · <span className="num">{selectedDate}</span>
          </div>
          <div className="mt-3 text-sm font-medium text-white/80">Output so far</div>
          <div className="flex items-baseline gap-2">
            <span className="num text-5xl font-semibold tracking-tight">{fmt0(k.productionKg)}</span>
            <span className="text-lg text-white/80">kg</span>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-white/20 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Output against target">
            <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-white/80">
            <span><span className="num font-semibold text-white">{fmt0(pct)}%</span> of day target</span>
            <span className="num">{fmtKg(k.targetKg)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-5 gap-3 content-center">
          <GlassTile icon={Cpu} label="Running" value={`${running}/${machines.length}`} hint="machines now" />
          <GlassTile icon={AlertTriangle} label="Alarms" value={activeAlarms} hint="open right now" />
          <GlassTile icon={Zap} label="Energy" value={`${fmt0(k.energyKwh)} kWh`} hint={k.productionKg ? `${fmt1(k.energyKwh / k.productionKg)} kWh / kg` : undefined} />
          <GlassTile icon={Clock} label="Run / Down" value={`${fmt0(k.runHours)}h / ${fmt0(k.downHours)}h`} hint={`${k.stoppages} stoppages`} />
          <GlassTile icon={Waves} label="CV index" value={fmt1(k.cvIndex)} hint="100 = on target" />
        </div>
      </div>
    </section>
  )
}

export default function OverviewBoard() {
  const { machines, activeAlarms, shift: liveShift } = useLive()
  const [date, setDate] = useState('')
  const [shift, setShift] = useState('ALL')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)

  const productionDate = liveShift?.shift.shiftDate
  const selectedDate = date || productionDate || isoDate(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api('/dashboard/summary', { params: { date: date || undefined, shift } }))
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [date, shift])

  useEffect(() => {
    load()
  }, [load])

  // Today's figures keep moving; refresh them every 30 seconds.
  useEffect(() => {
    if (date && date !== productionDate) return undefined
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load, date, productionDate])

  useEffect(() => {
    api('/dashboard/layout')
      .then((l) => setLayout({ kpis: normalise(l.kpis, DEFAULT_LAYOUT.kpis), widgets: normalise(l.widgets, DEFAULT_LAYOUT.widgets) }))
      .catch(() => {})
  }, [])

  const saveLayout = (next) => {
    setLayout(next)
    api('/dashboard/layout', { method: 'PUT', body: next }).catch(() => {})
  }

  const k = data?.kpi

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Fixed plant view for production day <span className="num font-semibold text-gray-800 dark:text-gray-200">{selectedDate}</span>. Drag cards by their grip to rearrange.
        </p>
        <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          className="form-input !w-auto"
          value={selectedDate}
          max={productionDate}
          onChange={(e) => setDate(e.target.value === productionDate ? '' : e.target.value)}
          aria-label="Production date"
        />
        <Segmented
          label="Shift"
          value={shift}
          onChange={setShift}
          options={[{ value: 'ALL', label: 'All' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }]}
        />
        <button className="btn-outline" onClick={load} disabled={loading} aria-label="Refresh">
          {loading ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
        </button>
        <button className="btn-outline" onClick={() => saveLayout(DEFAULT_LAYOUT)} title="Reset widget order">
          <RotateCcw className="w-4 h-4" /> <span className="hidden sm:inline">Reset layout</span>
        </button>
        </div>
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {!data ? (
        <div className="card p-10 flex justify-center text-gray-400"><Spinner className="w-6 h-6" /></div>
      ) : (
        <>
          <PlantPulse k={k} machines={machines} activeAlarms={activeAlarms} liveShift={liveShift} selectedDate={selectedDate} isToday={!date || date === productionDate} />
          <SortableGrid
            ids={layout.kpis}
            onReorder={(kpis) => saveLayout({ ...layout, kpis })}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5"
          >
            {layout.kpis.map((id) => (
              <SortableItem key={id} id={id}>
                {(handle) => <KpiGauge {...KPIS[id]} value={data.kpi[id]} previous={data.previous.productionKg > 0 ? data.previous[id] : null} handle={handle} />}
              </SortableItem>
            ))}
          </SortableGrid>


          <SortableGrid
            ids={layout.widgets}
            onReorder={(widgets) => saveLayout({ ...layout, widgets })}
            className="grid grid-cols-1 xl:grid-cols-3 gap-4"
          >
            {layout.widgets.map((id) => {
              const w = WIDGETS[id]
              return (
                <SortableItem key={id} id={id} className={w.span}>
                  {(handle) => (
                    <section className="card h-full flex flex-col">
                      <header className="card-header">
                        <div>
                          <h2 className="card-title">{w.title}</h2>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{w.subtitle}</p>
                        </div>
                        {handle}
                      </header>
                      <div className="p-4 h-72">
                        <w.Chart d={data} />
                      </div>
                    </section>
                  )}
                </SortableItem>
              )
            })}
          </SortableGrid>
        </>
      )}
    </>
  )
}
