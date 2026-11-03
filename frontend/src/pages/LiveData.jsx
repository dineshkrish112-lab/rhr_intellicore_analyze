import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Thermometer, Droplets, Gauge, Waves, Zap, Activity, User, ChevronRight, Radio, Cpu } from 'lucide-react'
import { useLive, usePlantClock } from '../context/LiveContext.jsx'
import ShiftClock from '../components/ShiftClock.jsx'
import { Meter, PageTitle, Segmented, StatusBadge, Empty } from '../components/ui.jsx'
import { ago, fmt0, fmt1, fmt2, fmtKg } from '../lib/format.js'

function Reading({ icon: Icon, label, value, unit, children }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase text-gray-400 dark:text-gray-500">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-base font-semibold text-gray-800 dark:text-gray-100 tabular-nums truncate">
        {value}
        <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
      </div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  )
}

function MachineCard({ m, now }) {
  const online = m.online
  const cvHigh = m.cvPercent > m.targetCv * 1.15
  const achieved = m.shiftTargetKg > 0 ? (100 * m.shiftProductionKg) / m.shiftTargetKg : 0
  return (
    <Link
      to={`/live/${m.machineId}`}
      className={`card p-4 flex flex-col gap-3 hover:ring-2 hover:ring-brand-400/50 transition ${!online ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 dark:text-gray-100">{m.code}</span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{m.type}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.name} · {m.line}</div>
        </div>
        <StatusBadge status={m.status} />
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-3">
        <Reading icon={Waves} label="CV%" value={fmt2(m.cvPercent)} unit="%">
          <div className={`text-[11px] ${cvHigh ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400'}`}>target {fmt1(m.targetCv)}</div>
        </Reading>
        <Reading icon={Gauge} label="Speed" value={fmt0(m.speed)} unit={m.speedUnit}>
          <Meter value={m.speed} max={m.ratedSpeed} />
        </Reading>
        <Reading icon={Thermometer} label="Temp" value={fmt1(m.temperature)} unit="°C">
          <Meter value={m.temperature} max={m.maxTemperature * 1.2} warnAt={m.maxTemperature} color="bg-sky-500" />
        </Reading>
        <Reading icon={Droplets} label="Humidity" value={fmt1(m.humidity)} unit="%RH" />
        <Reading icon={Zap} label="Power" value={fmt1(m.powerKw)} unit="kW" />
        <Reading icon={Activity} label="Vibration" value={fmt1(m.vibration)} unit="mm/s" />
      </div>

      <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500 dark:text-gray-400">
            Shift {m.shiftCode}: <span className="font-semibold text-gray-700 dark:text-gray-200">{fmtKg(m.shiftProductionKg)}</span> / {fmtKg(m.shiftTargetKg)}
          </span>
          <span className="font-semibold text-gray-700 dark:text-gray-200">OEE {fmt1(m.oee)}%</span>
        </div>
        <Meter value={achieved} max={100} color="bg-brand-500" />
        <div className="flex items-center justify-between mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="inline-flex items-center gap-1 truncate"><User className="w-3 h-3" /> {m.operatorName || '—'}</span>
          <span className="inline-flex items-center gap-1">
            <Radio className={`w-3 h-3 ${online ? 'text-green-500' : ''}`} />
            {m.source === 'DEVICE' ? 'Device' : 'Simulated'} · {ago(m.lastSeen, now)}
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function LiveData() {
  const { machines, shift } = useLive()
  const now = usePlantClock()
  const [dept, setDept] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [q, setQ] = useState('')

  const departments = useMemo(() => ['ALL', ...new Set(machines.map((m) => m.department))], [machines])
  const list = machines.filter(
    (m) =>
      (dept === 'ALL' || m.department === dept) &&
      (status === 'ALL' || (status === 'ISSUE' ? m.status !== 'RUNNING' : m.status === status)) &&
      (!q || `${m.code} ${m.name} ${m.type}`.toLowerCase().includes(q.toLowerCase())),
  )

  const totals = machines.reduce(
    (a, m) => ({ prod: a.prod + m.shiftProductionKg, target: a.target + m.shiftTargetKg, energy: a.energy + m.energyKwh, oee: a.oee + m.oee }),
    { prod: 0, target: 0, energy: 0, oee: 0 },
  )
  const running = machines.filter((m) => m.status === 'RUNNING').length
  const online = machines.filter((m) => m.online).length

  return (
    <>
      <PageTitle title="Live Machine Data" subtitle="Real-time telemetry, refreshed every few seconds" />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
        <div className="xl:col-span-3">
          <ShiftClock />
        </div>
        <div className="xl:col-span-2 card p-5">
          <h2 className="card-title mb-4">Current shift at a glance</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Shift output', fmtKg(totals.prod), totals.target ? `${fmt0((100 * totals.prod) / totals.target)}% of shift target` : ''],
              ['Average OEE', `${fmt1(machines.length ? totals.oee / machines.length : 0)}%`, 'across all machines'],
              ['Running', `${running} / ${machines.length}`, `${machines.length - running} need attention`],
              ['Gateways online', `${online} / ${machines.length}`, 'reporting within 30 s'],
              ['Energy', `${fmt0(totals.energy)} kWh`, 'this shift so far'],
              ['Production day', shift?.shift.shiftDate ?? '–', shift ? shift.shift.name : ''],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
                <div className="text-[11px] uppercase font-semibold text-gray-400 dark:text-gray-500">{label}</div>
                <div className="text-lg font-bold text-gray-800 dark:text-gray-100 tabular-nums">{value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{hint}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="relative lg:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="form-input pl-9" placeholder="Search machine, code or type" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search machines" />
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <Segmented label="Department" value={dept} onChange={setDept} options={departments.map((d) => ({ value: d, label: d === 'ALL' ? 'All departments' : d }))} />
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ALL', label: 'Any status' },
              { value: 'RUNNING', label: 'Running' },
              { value: 'ISSUE', label: 'Not running' },
            ]}
          />
        </div>
      </div>

      {machines.length === 0 ? (
        <div className="card"><Empty><Cpu className="w-4 h-4 mr-2" /> Waiting for telemetry…</Empty></div>
      ) : list.length === 0 ? (
        <div className="card"><Empty>No machines match the filters</Empty></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {list.map((m) => (
            <MachineCard key={m.machineId} m={m} now={now} />
          ))}
        </div>
      )}
    </>
  )
}
