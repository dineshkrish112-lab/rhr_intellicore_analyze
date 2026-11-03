import { Bar, Doughnut, Line, Scatter } from 'react-chartjs-2'
import { STATUS, axes, legend, useChartTheme } from './chartTheme.js'
import { Empty } from '../components/ui.jsx'
import { fmt1 } from '../lib/format.js'

const BAR = { borderRadius: 4, borderSkipped: 'start', maxBarThickness: 28, categoryPercentage: 0.7, barPercentage: 0.9 }

export function HourlyProduction({ hourly }) {
  const t = useChartTheme()
  if (!hourly?.length) return <Empty>No telemetry recorded for this period</Empty>
  return (
    <Bar
      data={{
        labels: hourly.map((h) => h.hour),
        datasets: [{ label: 'Production', data: hourly.map((h) => h.productionKg), backgroundColor: t.series[0], ...BAR }],
      }}
      options={{
        interaction: { mode: 'index', intersect: false },
        scales: axes(t, { yTitle: 'kg' }),
        plugins: { legend: legend(t, false), tooltip: { ...t.tooltip, callbacks: { label: (c) => ` ${fmt1(c.parsed.y)} kg` } } },
      }}
    />
  )
}

export function CvIndexHourly({ hourly }) {
  const t = useChartTheme()
  if (!hourly?.length) return <Empty>No telemetry recorded for this period</Empty>
  return (
    <Line
      data={{
        labels: hourly.map((h) => h.hour),
        datasets: [
          {
            label: 'CV index',
            data: hourly.map((h) => h.cvIndex),
            borderColor: t.series[6],
            backgroundColor: t.series[6] + '22',
            fill: true,
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
          {
            label: 'Target (100)',
            data: hourly.map(() => 100),
            borderColor: t.text,
            borderDash: [4, 4],
            borderWidth: 1,
            pointRadius: 0,
          },
        ],
      }}
      options={{
        interaction: { mode: 'index', intersect: false },
        scales: axes(t, { yTitle: '% of target CV', yMin: 85, yMax: 120 }),
        plugins: { legend: legend(t), tooltip: { ...t.tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt1(c.parsed.y)}` } } },
      }}
    />
  )
}

export function OeeTrend({ trend }) {
  const t = useChartTheme()
  if (!trend?.length) return <Empty>No history</Empty>
  const series = [
    ['OEE', 'oee', 0],
    ['Availability', 'availability', 1],
    ['Performance', 'performance', 2],
    ['Quality', 'quality', 3],
  ]
  return (
    <Line
      data={{
        labels: trend.map((d) => d.date.slice(5)),
        datasets: series.map(([label, key, slot]) => ({
          label,
          data: trend.map((d) => d[key]),
          borderColor: t.series[slot],
          backgroundColor: t.series[slot],
          borderWidth: key === 'oee' ? 2.5 : 2,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
        })),
      }}
      options={{
        interaction: { mode: 'index', intersect: false },
        scales: axes(t, { yTitle: '%', yMin: 60, yMax: 100 }),
        plugins: { legend: legend(t), tooltip: { ...t.tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt1(c.parsed.y)}%` } } },
      }}
    />
  )
}

export function SpeedCvScatter({ scatter }) {
  const t = useChartTheme()
  if (!scatter?.length) return <Empty>No running samples for this period</Empty>
  const shifts = [...new Set(scatter.map((p) => p.shiftCode))].sort()
  return (
    <Scatter
      data={{
        datasets: shifts.map((code) => ({
          label: `Shift ${code}`,
          data: scatter.filter((p) => p.shiftCode === code).map((p) => ({ x: p.speedUtilisation, y: p.cvIndex, p })),
          backgroundColor: t.shift(code),
          borderColor: t.surface,
          borderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        })),
      }}
      options={{
        scales: axes(t, { xTitle: 'Speed utilisation (% of rated)', yTitle: 'CV index (% of target)', yMin: 85, yMax: 120 }),
        plugins: {
          legend: legend(t),
          tooltip: {
            ...t.tooltip,
            callbacks: {
              title: (items) => `${items[0].raw.p.machineCode} · Shift ${items[0].raw.p.shiftCode}`,
              label: (c) => [
                ` Speed: ${fmt1(c.raw.p.speedUtilisation)}% of rated`,
                ` CV: ${c.raw.p.avgCv}% (${fmt1(c.raw.p.cvIndex)}% of target)`,
                ` Output: ${fmt1(c.raw.p.productionKg)} kg`,
              ],
            },
          },
        },
      }}
    />
  )
}

export function ShiftProduction({ shiftWise }) {
  const t = useChartTheme()
  if (!shiftWise?.length) return <Empty>No data</Empty>
  return (
    <Bar
      data={{
        labels: shiftWise.map((s) => `Shift ${s.shiftCode}`),
        datasets: [
          { label: 'Production', data: shiftWise.map((s) => s.productionKg), backgroundColor: shiftWise.map((s) => t.shift(s.shiftCode)), ...BAR, maxBarThickness: 40 },
          { label: 'Target', data: shiftWise.map((s) => s.targetKg), backgroundColor: t.muted, ...BAR, maxBarThickness: 40 },
        ],
      }}
      options={{
        interaction: { mode: 'index', intersect: false },
        scales: axes(t, { yTitle: 'kg' }),
        plugins: {
          // Bars are identified by the x-axis label; the card subtitle explains colour vs grey target.
          legend: legend(t, false),
          tooltip: {
            ...t.tooltip,
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${fmt1(c.parsed.y)} kg`,
              afterBody: (items) => {
                const s = shiftWise[items[0].dataIndex]
                return [`OEE ${fmt1(s.oee)}%`]
              },
            },
          },
        },
      }}
    />
  )
}

export function MachineOee({ machineWise }) {
  const t = useChartTheme()
  const rows = [...(machineWise || [])].filter((m) => m.productionKg > 0).sort((a, b) => b.oee - a.oee)
  if (!rows.length) return <Empty>No data</Empty>
  return (
    <Bar
      data={{
        labels: rows.map((m) => m.machineCode),
        datasets: [{ label: 'OEE', data: rows.map((m) => m.oee), backgroundColor: t.series[0], ...BAR, maxBarThickness: 16 }],
      }}
      options={{
        indexAxis: 'y',
        scales: {
          x: { ...axes(t).y, min: 50, max: 100, beginAtZero: false, title: { display: true, text: 'OEE %', color: t.text } },
          y: { ...axes(t).x, ticks: { color: t.text, autoSkip: false, font: { size: 11 } } },
        },
        plugins: {
          legend: legend(t, false),
          tooltip: {
            ...t.tooltip,
            callbacks: { label: (c) => ` OEE ${fmt1(c.parsed.x)}% · ${fmt1(rows[c.dataIndex].productionKg)} kg` },
          },
        },
      }}
    />
  )
}

export function MachineStatus({ counts, total }) {
  const t = useChartTheme()
  const entries = Object.entries(counts || {})
  if (!entries.length) return <Empty>Live status is shown for the current production day</Empty>
  return (
    <div className="flex items-center gap-6 h-full">
      <div className="relative w-40 h-40 shrink-0">
        <Doughnut
          data={{
            labels: entries.map(([k]) => STATUS[k]?.label || k),
            datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map(([k]) => STATUS[k]?.color), borderColor: t.surface, borderWidth: 2 }],
          }}
          options={{ cutout: '72%', plugins: { legend: { display: false }, tooltip: t.tooltip } }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{total}</div>
          <div className="text-xs text-gray-400">machines</div>
        </div>
      </div>
      <ul className="space-y-2 text-sm flex-1">
        {entries.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS[k]?.color }} />
              {STATUS[k]?.label || k}
            </span>
            <span className="font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
