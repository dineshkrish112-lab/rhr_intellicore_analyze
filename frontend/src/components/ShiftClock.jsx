import { useEffect, useState } from 'react'
import { Timer, ArrowRight } from 'lucide-react'
import { api } from '../lib/api.js'
import { useLive, usePlantClock } from '../context/LiveContext.jsx'
import { useChartTheme } from '../charts/chartTheme.js'
import { fmtDuration, parseLocal } from '../lib/format.js'

const R = 92
const C = 110

function polar(angleDeg, r = R) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}

function arc(startDeg, endDeg, r = R) {
  let end = endDeg
  if (end <= startDeg) end += 360
  if (end - startDeg >= 360) end = startDeg + 359.99
  const [x1, y1] = polar(startDeg, r)
  const [x2, y2] = polar(end, r)
  return `M ${x1} ${y1} A ${r} ${r} 0 ${end - startDeg > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

const toDeg = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return ((h * 60 + m) / 1440) * 360
}

/**
 * 24-hour shift dial: each shift is an arc on the day ring, the active shift fills as it
 * progresses, and the hand tracks plant time. Digital time and countdown sit alongside.
 */
export default function ShiftClock({ compact = false }) {
  const now = usePlantClock()
  const { shift } = useLive()
  const t = useChartTheme()
  const [defs, setDefs] = useState([])

  useEffect(() => {
    api('/shifts').then(setDefs).catch(() => {})
  }, [])

  const d = new Date(now)
  const dayDeg = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400) * 360
  const cur = shift?.shift
  const start = parseLocal(cur?.start)
  const end = parseLocal(cur?.end)
  const total = start && end ? (end - start) / 1000 : 1
  const elapsed = start ? Math.min(total, Math.max(0, (now - start.getTime()) / 1000)) : 0
  const remaining = Math.max(0, total - elapsed)
  const progress = (elapsed / total) * 100
  const curColor = cur ? t.shift(cur.code) : t.series[0]
  const startDeg = cur ? toDeg(cur.start.slice(11, 16)) : 0
  const [hx, hy] = polar(dayDeg, R - 22)
  const [dotx, doty] = polar(dayDeg, R)

  return (
    <div className={`card p-5 ${compact ? '' : 'h-full'}`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="card-title flex items-center gap-2">
          <Timer className="w-4 h-4 text-brand-500" /> Shift Clock
        </h2>
        {cur && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: curColor }}>
            {cur.name}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <svg viewBox="0 0 220 220" className="w-52 h-52 shrink-0" role="img" aria-label={`Plant time ${d.toLocaleTimeString('en-IN', { hour12: false })}, ${cur?.name ?? ''}`}>
          <circle cx={C} cy={C} r={R + 16} fill="none" stroke={t.grid} strokeWidth="1" />
          {defs.map((s) => (
            <path
              key={s.code}
              d={arc(toDeg(s.startTime.slice(0, 5)), toDeg(s.endTime.slice(0, 5)))}
              stroke={t.shift(s.code)}
              strokeOpacity={cur?.code === s.code ? 0.25 : 0.12}
              strokeWidth="14"
              fill="none"
            />
          ))}
          {cur && <path d={arc(startDeg, startDeg + (progress / 100) * (total / 86400) * 360)} stroke={curColor} strokeWidth="14" strokeLinecap="round" fill="none" />}
          {Array.from({ length: 24 }).map((_, h) => {
            const [x1, y1] = polar(h * 15, R + 10)
            const [x2, y2] = polar(h * 15, R + (h % 6 === 0 ? 16 : 13))
            return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t.text} strokeOpacity={h % 6 === 0 ? 0.9 : 0.4} strokeWidth={h % 6 === 0 ? 2 : 1} />
          })}
          {[0, 6, 12, 18].map((h) => {
            const [x, y] = polar(h * 15, R - 30)
            return (
              <text key={h} x={x} y={y + 4} textAnchor="middle" fontSize="10" fill={t.text} fontWeight="600">
                {String(h).padStart(2, '0')}
              </text>
            )
          })}
          <line x1={C} y1={C} x2={hx} y2={hy} stroke={t.dark ? '#f3f4f6' : '#1f2937'} strokeWidth="3" strokeLinecap="round" />
          <circle cx={C} cy={C} r="5" fill={t.dark ? '#f3f4f6' : '#1f2937'} />
          <circle cx={dotx} cy={doty} r="6" fill={curColor} stroke={t.surface} strokeWidth="2" />
        </svg>

        <div className="flex-1 w-full min-w-0">
          <div className="text-4xl font-bold tabular-nums tracking-tight text-gray-800 dark:text-gray-100">
            {d.toLocaleTimeString('en-IN', { hour12: false })}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>

          {cur && (
            <>
              <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <span>
                  {cur.start.slice(11, 16)} – {cur.end.slice(11, 16)}
                </span>
                <span className="tabular-nums">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700/60 overflow-hidden mb-4" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Shift progress">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, background: curColor }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                  <div className="text-[11px] uppercase font-semibold text-gray-400 dark:text-gray-500">Elapsed</div>
                  <div className="text-lg font-semibold tabular-nums text-gray-800 dark:text-gray-100">{fmtDuration(elapsed)}</div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                  <div className="text-[11px] uppercase font-semibold text-gray-400 dark:text-gray-500">Remaining</div>
                  <div className="text-lg font-semibold tabular-nums text-gray-800 dark:text-gray-100">{fmtDuration(remaining)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                {defs.map((s) => (
                  <span key={s.code} className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.shift(s.code) }} />
                    <span className="font-medium text-gray-700 dark:text-gray-300">{s.code}</span>
                    {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                  </span>
                ))}
              </div>
              {shift.next && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <ArrowRight className="w-3.5 h-3.5" /> Next:
                  <span className="w-2 h-2 rounded-full" style={{ background: t.shift(shift.next.code) }} />
                  <span className="font-medium text-gray-700 dark:text-gray-300">{shift.next.name}</span>
                  at {shift.next.start.slice(11, 16)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
