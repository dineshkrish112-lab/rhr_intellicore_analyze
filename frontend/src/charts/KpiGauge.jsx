import { Doughnut } from 'react-chartjs-2'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useChartTheme } from './chartTheme.js'
import { InfoTip } from '../components/ui.jsx'

// Bands follow common OEE benchmarks: 85% world class, 60% typical floor.
function band(value, good, fair) {
  if (value >= good) return { label: 'On target', color: '#16a34a', text: 'text-green-700 dark:text-green-400' }
  if (value >= fair) return { label: 'Watch', color: '#d97706', text: 'text-amber-700 dark:text-amber-400' }
  return { label: 'Below target', color: '#dc2626', text: 'text-red-700 dark:text-red-400' }
}

/** Half-ring gauge with the value, its band and the change against the previous day. */
export default function KpiGauge({ title, subtitle, info, value, previous, good, fair, handle }) {
  const t = useChartTheme()
  const b = band(value, good, fair)
  const delta = previous != null ? value - previous : null
  const data = {
    datasets: [
      {
        data: [value, Math.max(0, 100 - value)],
        backgroundColor: [b.color, t.muted],
        borderWidth: 0,
        borderRadius: [4, 0],
      },
    ],
  }
  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-gray-50 flex items-center gap-1.5">{title} {info && <InfoTip text={info} />}</h3>
          <div className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</div>
        </div>
        {handle}
      </div>
      <div className="relative h-28 mt-3">
        <Doughnut
          data={data}
          options={{
            rotation: -90,
            circumference: 180,
            cutout: '78%',
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { duration: 600 },
          }}
          aria-label={`${title} ${value.toFixed(1)} percent`}
          role="img"
        />
        <div className="absolute inset-x-0 bottom-1 text-center">
          <div className="num text-3xl font-semibold text-gray-900 dark:text-gray-50">
            {value.toFixed(1)}
            <span className="text-lg text-gray-400">%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs">
        <span className={`font-semibold ${b.text}`}>● {b.label}</span>
        {delta != null && (
          <span className={`inline-flex items-center gap-1 font-medium ${delta >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)} pts vs prev. day
          </span>
        )}
      </div>
    </div>
  )
}
