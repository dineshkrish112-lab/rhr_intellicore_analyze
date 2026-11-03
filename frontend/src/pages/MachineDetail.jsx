import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import { ArrowLeft, CalendarClock, CheckCircle2, Clock4, PlayCircle } from 'lucide-react'
import { api } from '../lib/api.js'
import { useLive, usePlantClock } from '../context/LiveContext.jsx'
import { axes, legend, useChartTheme } from '../charts/chartTheme.js'
import { Alert, Empty, PageTitle, Segmented, StatusBadge } from '../components/ui.jsx'
import { ago, fmt0, fmt1, fmt2, fmtDateTime, fmtKg } from '../lib/format.js'

function TrendChart({ title, points, field, unit, color, limit, limitLabel }) {
  const t = useChartTheme()
  const datasets = [
    {
      label: title,
      data: points.map((p) => p[field]),
      borderColor: color,
      backgroundColor: color + '1f',
      fill: true,
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
  ]
  if (limit != null) {
    datasets.push({ label: limitLabel, data: points.map(() => limit), borderColor: t.text, borderDash: [4, 4], borderWidth: 1, pointRadius: 0 })
  }
  return (
    <section className="card">
      <header className="card-header">
        <h3 className="card-title text-sm">{title}</h3>
        <span className="text-xs text-gray-400">{unit}</span>
      </header>
      <div className="p-3 h-56">
        {points.length === 0 ? (
          <Empty>No readings in this window</Empty>
        ) : (
          <Line
            data={{ labels: points.map((p) => p.ts.slice(11, 16)), datasets }}
            options={{
              interaction: { mode: 'index', intersect: false },
              scales: { ...axes(t), x: { ...axes(t).x, ticks: { color: t.text, maxTicksLimit: 8, autoSkip: true } }, y: { ...axes(t).y, beginAtZero: false } },
              plugins: {
                legend: legend(t, limit != null),
                tooltip: { ...t.tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt2(c.parsed.y)} ${unit}` } },
              },
            }}
          />
        )}
      </div>
    </section>
  )
}

const STATE_ICON = { COMPLETED: CheckCircle2, RUNNING: PlayCircle, UPCOMING: Clock4 }

function ShiftPanel({ entry, machine }) {
  const s = entry.summary
  const w = entry.window
  if (entry.state === 'UPCOMING') {
    return <Empty>Shift {w.code} starts at {w.start.slice(11, 16)}</Empty>
  }
  if (!s) return <Empty>No data recorded for this shift</Empty>
  const rows = [
    ['Production', fmtKg(s.productionKg)],
    ['Shift target', fmtKg(s.targetKg)],
    ['Rejects', `${fmt1(s.rejectKg)} kg`],
    ['Run time', `${fmt0(s.runSec / 60)} min`],
    ['Down time', `${fmt0(s.downSec / 60)} min`],
    ['Stoppages', s.stoppages],
    ['End breaks', s.breaks],
    ['Avg speed', `${fmt0(s.avgSpeed)} ${machine?.speedUnit ?? ''}`],
    ['Avg CV%', `${fmt2(s.avgCv)} %`],
    ['Avg temperature', `${fmt1(s.avgTemperature)} °C`],
    ['Avg humidity', `${fmt1(s.avgHumidity)} %RH`],
    ['Energy', `${fmt1(s.energyKwh)} kWh`],
  ]
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="grid grid-cols-2 gap-3">
        {[
          ['OEE', s.oee],
          ['Availability', s.availability],
          ['Performance', s.performance],
          ['Quality', s.quality],
        ].map(([label, v]) => (
          <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
            <div className="text-[11px] uppercase font-semibold text-gray-400 dark:text-gray-500">{label}</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">{fmt1(v)}%</div>
          </div>
        ))}
      </div>
      <dl className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-xs text-gray-400 dark:text-gray-500">{k}</dt>
            <dd className="font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{v}</dd>
          </div>
        ))}
        <div className="flex flex-col col-span-2 sm:col-span-3">
          <dt className="text-xs text-gray-400 dark:text-gray-500">Operator · last update</dt>
          <dd className="font-medium text-gray-700 dark:text-gray-300">
            {s.operatorName || '—'} · {fmtDateTime(s.updatedAt)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export default function MachineDetail() {
  const { machineId } = useParams()
  const { machines, shift } = useLive()
  const now = usePlantClock()
  const t = useChartTheme()
  const m = machines.find((x) => String(x.machineId) === machineId)
  const [info, setInfo] = useState(null)
  const [minutes, setMinutes] = useState(120)
  const [points, setPoints] = useState([])
  const [date, setDate] = useState('')
  const [shifts, setShifts] = useState([])
  const [tab, setTab] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/machines/${machineId}`).then(setInfo).catch((e) => setError(e.message))
  }, [machineId])

  useEffect(() => {
    let alive = true
    const load = () => api(`/live/${machineId}/trend`, { params: { minutes } }).then((p) => alive && setPoints(p)).catch(() => {})
    load()
    const id = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [machineId, minutes])

  useEffect(() => {
    let alive = true
    const load = () =>
      api(`/live/${machineId}/shifts`, { params: { date: date || undefined } })
        .then((s) => {
          if (!alive) return
          setShifts(s)
          setTab((cur) => cur ?? (s.find((x) => x.state === 'RUNNING') || s[s.length - 1])?.window.code)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 20000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [machineId, date])

  const productionDate = shift?.shift.shiftDate
  const active = shifts.find((s) => s.window.code === tab)

  return (
    <>
      <Link to="/live" className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600 mb-3">
        <ArrowLeft className="w-4 h-4" /> All machines
      </Link>
      <PageTitle
        title={m ? `${m.code} · ${m.name}` : info ? `${info.code} · ${info.name}` : 'Machine'}
        subtitle={info ? `${info.type} · ${info.make} ${info.model} · ${info.department}, ${info.line}${info.spindles ? ` · ${info.spindles} spindles` : ''}` : ''}
      >
        {m && <StatusBadge status={m.status} size="md" />}
        {m && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {m.source === 'DEVICE' ? 'Device feed' : 'Simulated feed'} · updated {ago(m.lastSeen, now)}
          </span>
        )}
      </PageTitle>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {m && (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
          {[
            ['CV%', fmt2(m.cvPercent), `target ${fmt1(m.targetCv)}`],
            ['Speed', fmt0(m.speed), `${m.speedUnit} · rated ${fmt0(m.ratedSpeed)}`],
            ['Temperature', `${fmt1(m.temperature)}°C`, `limit ${fmt0(m.maxTemperature)}°C`],
            ['Humidity', `${fmt1(m.humidity)}%`, 'relative'],
            ['Power', `${fmt1(m.powerKw)} kW`, `${fmt1(m.energyKwh)} kWh this shift`],
            ['Vibration', `${fmt1(m.vibration)}`, 'mm/s RMS'],
            ['Shift output', fmtKg(m.shiftProductionKg), `of ${fmtKg(m.shiftTargetKg)}`],
            ['OEE (shift)', `${fmt1(m.oee)}%`, `A ${fmt0(m.availability)} · P ${fmt0(m.performance)} · Q ${fmt0(m.quality)}`],
          ].map(([label, value, hint]) => (
            <div key={label} className="card px-4 py-3">
              <div className="text-[11px] uppercase font-semibold text-gray-400 dark:text-gray-500">{label}</div>
              <div className="text-xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">{value}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{hint}</div>
            </div>
          ))}
        </div>
      )}

      <section className="card mb-6">
        <header className="card-header flex-wrap">
          <h2 className="card-title flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-brand-500" /> Shift-wise performance
          </h2>
          <input
            type="date"
            className="form-input !w-auto"
            value={date || productionDate || ''}
            max={productionDate}
            onChange={(e) => {
              setDate(e.target.value === productionDate ? '' : e.target.value)
              setTab(null)
            }}
            aria-label="Production date"
          />
        </header>
        <div className="px-5 pt-4 flex flex-wrap gap-2" role="tablist">
          {shifts.map((s) => {
            const Icon = STATE_ICON[s.state]
            const selected = s.window.code === tab
            return (
              <button
                key={s.window.code}
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(s.window.code)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-left transition ${
                  selected ? 'border-brand-400 bg-brand-500/5' : 'border-gray-200 dark:border-gray-700/60 hover:border-gray-300'
                }`}
              >
                <span className="w-1.5 self-stretch rounded-full" style={{ background: t.shift(s.window.code) }} />
                <span>
                  <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{s.window.name}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Icon className="w-3.5 h-3.5" /> {s.state.toLowerCase()} · {s.window.start.slice(11, 16)}–{s.window.end.slice(11, 16)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="p-5">{active ? <ShiftPanel entry={active} machine={info} /> : <Empty>Loading shifts…</Empty>}</div>
      </section>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Live trends</h2>
        <Segmented
          label="Trend window"
          value={minutes}
          onChange={setMinutes}
          options={[
            { value: 30, label: '30m' },
            { value: 120, label: '2h' },
            { value: 480, label: '8h' },
            { value: 1440, label: '24h' },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart title="Speed" points={points} field="speed" unit={info?.speedUnit ?? ''} color={t.series[0]} limit={info?.ratedSpeed} limitLabel="Rated" />
        <TrendChart title="CV%" points={points} field="cvPercent" unit="%" color={t.series[6]} limit={info?.targetCv} limitLabel="Target" />
        <TrendChart title="Temperature" points={points} field="temperature" unit="°C" color={t.series[1]} limit={info?.maxTemperature} limitLabel="Limit" />
        <TrendChart title="Power" points={points} field="powerKw" unit="kW" color={t.series[2]} />
      </div>
    </>
  )
}
