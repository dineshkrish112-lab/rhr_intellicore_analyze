import { Bar, Doughnut, Line, Scatter } from 'react-chartjs-2'
import { axes, legend, useChartTheme } from '../../charts/chartTheme.js'
import { Empty } from '../ui.jsx'
import { fmt1, fmt2 } from '../../lib/format.js'

const MAX_SERIES = 8

function fmtValue(v, unit) {
  if (v == null) return '–'
  const abs = Math.abs(v)
  const s = Number.isInteger(v) && abs < 100000 ? v.toLocaleString('en-IN') : abs >= 100000 ? `${fmt1(v / 1000)}k` : abs >= 100 ? Math.round(v).toLocaleString('en-IN') : fmt2(v)
  return unit ? `${s} ${unit}` : s
}

/**
 * Shapes a query result into chart series. One group-by column gives one series per value
 * column; a second group-by column splits the first value column into one series per item.
 */
export function pivot(result) {
  const dims = result.columns.filter((c) => c.key.startsWith('d'))
  const measures = result.columns.filter((c) => c.key.startsWith('m'))
  const idx = Object.fromEntries(result.columns.map((c, i) => [c.key, i]))
  if (dims.length === 2) {
    const labels = [...new Set(result.rows.map((r) => r[idx.d0]))]
    const allKeys = [...new Set(result.rows.map((r) => r[idx.d1]))]
    const keys = allKeys.slice(0, MAX_SERIES)
    const series = keys.map((k) => ({
      label: String(k),
      data: labels.map((l) => {
        const row = result.rows.find((r) => r[idx.d0] === l && r[idx.d1] === k)
        return row ? row[idx.m0] : null
      }),
    }))
    return { labels, series, unit: measures[0]?.unit, dropped: allKeys.length - keys.length }
  }
  const labels = result.rows.map((r) => (dims.length ? r[idx.d0] : ''))
  const series = measures.slice(0, MAX_SERIES).map((m) => ({ label: m.label, unit: m.unit, data: result.rows.map((r) => r[idx[m.key]]) }))
  const units = [...new Set(measures.map((m) => m.unit || ''))]
  return { labels, series, unit: units.length === 1 ? units[0] : '', dropped: 0, mixedUnits: units.length > 1 }
}

function StatView({ result }) {
  const m = result.columns.find((c) => c.key === 'm0')
  const v = result.rows[0]?.[result.columns.indexOf(m)]
  const others = result.columns.filter((c) => c.key.startsWith('m') && c.key !== 'm0')
  return (
    <div className="h-full flex flex-col justify-center">
      <div className="eyebrow">{m?.label}</div>
      <div className="num text-4xl font-semibold text-gray-900 dark:text-white mt-1">
        {fmtValue(v, '')}
        {m?.unit && <span className="text-lg text-gray-400 ml-1">{m.unit}</span>}
      </div>
      {others.map((o) => (
        <div key={o.key} className="text-sm text-gray-500 mt-1">
          {o.label}: <span className="num font-semibold text-gray-700 dark:text-gray-200">{fmtValue(result.rows[0]?.[result.columns.indexOf(o)], o.unit)}</span>
        </div>
      ))}
      {result.from && <div className="text-xs text-gray-400 mt-3 num">{result.from} → {result.to}</div>}
    </div>
  )
}

function TableView({ result }) {
  return (
    <div className="h-full overflow-auto -mx-1">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white dark:bg-gray-900">
          <tr className="border-b border-gray-100 dark:border-gray-800">
            {result.columns.map((c) => (
              <th key={c.key} className={`px-2 py-2 eyebrow whitespace-nowrap ${c.type === 'number' ? 'text-right' : 'text-left'}`}>
                {c.label}
                {c.unit ? ` (${c.unit})` : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {result.rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
              {r.map((v, j) => (
                <td key={j} className={`px-2 py-1.5 whitespace-nowrap ${result.columns[j].type === 'number' ? 'text-right num' : 'font-medium text-gray-800 dark:text-gray-200'}`}>
                  {result.columns[j].type === 'number' ? fmtValue(v, '') : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function WidgetChart({ type, result, stacked }) {
  const t = useChartTheme()
  if (!result) return <Empty>Loading…</Empty>
  if (!result.rows.length) return <Empty>No data for this selection and date range</Empty>
  if (type === 'stat') return <StatView result={result} />
  if (type === 'table') return <TableView result={result} />

  const tooltip = (unit) => ({ ...t.tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtValue(c.parsed.y ?? c.parsed, unit ?? c.dataset.unit)}` } })

  if (type === 'scatter') {
    const idx = Object.fromEntries(result.columns.map((c, i) => [c.key, i]))
    const xCol = result.columns.find((c) => c.key === 'm0')
    const yCol = result.columns.find((c) => c.key === 'm1')
    if (!yCol) return <Empty>A scatter plot needs two value columns (X and Y)</Empty>
    const groups = idx.d1 != null ? [...new Set(result.rows.map((r) => r[idx.d1]))].slice(0, MAX_SERIES) : [null]
    return (
      <Scatter
        data={{
          datasets: groups.map((g, i) => ({
            label: g == null ? `${yCol.label} vs ${xCol.label}` : String(g),
            data: result.rows.filter((r) => g == null || r[idx.d1] === g).map((r) => ({ x: r[idx.m0], y: r[idx.m1], name: idx.d0 != null ? r[idx.d0] : '' })),
            backgroundColor: t.series[i],
            borderColor: t.surface,
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
          })),
        }}
        options={{
          scales: {
            x: { ...axes(t).y, beginAtZero: false, title: { display: true, text: `${xCol.label}${xCol.unit ? ` (${xCol.unit})` : ''}`, color: t.text } },
            y: { ...axes(t).y, beginAtZero: false, title: { display: true, text: `${yCol.label}${yCol.unit ? ` (${yCol.unit})` : ''}`, color: t.text } },
          },
          plugins: {
            legend: legend(t, groups.length > 1),
            tooltip: {
              ...t.tooltip,
              callbacks: {
                title: (items) => items[0].raw.name,
                label: (c) => [` ${xCol.label}: ${fmtValue(c.raw.x, xCol.unit)}`, ` ${yCol.label}: ${fmtValue(c.raw.y, yCol.unit)}`],
              },
            },
          },
        }}
      />
    )
  }

  const p = pivot(result)
  // Hourly buckets within a single day read better as just the hour.
  if (p.labels.length && p.labels.every((l) => typeof l === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:00$/.test(l))) {
    const days = new Set(p.labels.map((l) => l.slice(0, 10)))
    p.labels = p.labels.map((l) => (days.size === 1 ? l.slice(11) : `${l.slice(8, 10)}/${l.slice(5, 7)} ${l.slice(11)}`))
  }

  if (type === 'pie') {
    const values = p.series[0].data
    const top = p.labels.map((l, i) => ({ l, v: values[i] ?? 0 })).sort((a, b) => b.v - a.v)
    const shown = top.slice(0, 7)
    const rest = top.slice(7).reduce((a, x) => a + x.v, 0)
    if (rest > 0) shown.push({ l: 'Other', v: rest })
    const total = shown.reduce((a, x) => a + x.v, 0)
    return (
      <div className="flex items-center gap-4 h-full">
        <div className="relative w-40 h-40 shrink-0">
          <Doughnut
            data={{
              labels: shown.map((x) => x.l),
              datasets: [{ data: shown.map((x) => x.v), backgroundColor: shown.map((x, i) => (x.l === 'Other' ? t.muted : t.series[i])), borderColor: t.surface, borderWidth: 2 }],
            }}
            options={{ cutout: '68%', plugins: { legend: { display: false }, tooltip: tooltip(p.unit) } }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="num text-xl font-semibold text-gray-900 dark:text-white">{fmtValue(total, '')}</div>
            <div className="text-[11px] text-gray-400">{p.unit || 'total'}</div>
          </div>
        </div>
        <ul className="flex-1 min-w-0 space-y-1.5 text-sm">
          {shown.map((x, i) => (
            <li key={x.l} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0 text-gray-600 dark:text-gray-300">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: x.l === 'Other' ? t.muted : t.series[i] }} />
                <span className="truncate">{x.l}</span>
              </span>
              <span className="num text-xs font-semibold text-gray-800 dark:text-gray-100">{total ? Math.round((100 * x.v) / total) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const multi = p.series.length > 1
  const datasets = p.series.map((s, i) => {
    const color = t.series[i]
    if (type === 'bar') {
      return { ...s, backgroundColor: color, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 32, categoryPercentage: 0.75, barPercentage: 0.9 }
    }
    return {
      ...s,
      borderColor: color,
      backgroundColor: type === 'area' ? color + (multi ? '33' : '26') : color,
      fill: type === 'area' ? (stacked && i > 0 ? '-1' : 'origin') : false,
      borderWidth: 2,
      tension: 0.3,
      pointRadius: p.labels.length > 40 ? 0 : 2.5,
      pointHoverRadius: 5,
      spanGaps: true,
    }
  })
  const Chart = type === 'bar' ? Bar : Line
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <Chart
          data={{ labels: p.labels, datasets }}
          options={{
            interaction: { mode: 'index', intersect: false },
            scales: axes(t, { yTitle: p.unit || undefined, stacked: !!stacked }),
            plugins: { legend: legend(t, multi), tooltip: tooltip() },
          }}
        />
      </div>
      {(p.dropped > 0 || p.mixedUnits) && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
          {p.dropped > 0 && `Showing the first ${MAX_SERIES} series (${p.dropped} more hidden). `}
          {p.mixedUnits && 'Values use different units on one axis; consider separate widgets.'}
        </p>
      )}
    </div>
  )
}
