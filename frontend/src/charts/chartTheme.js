import { Chart, registerables } from 'chart.js'
import { useTheme } from '../context/ThemeContext.jsx'

Chart.register(...registerables)
Chart.defaults.font.family = 'Inter, sans-serif'
Chart.defaults.font.size = 12
Chart.defaults.maintainAspectRatio = false
Chart.defaults.animation.duration = 400

// Categorical slots in fixed order, stepped separately for each surface (validated palette).
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

/** Reserved for machine state; always shown with a text label, never colour alone. */
export const STATUS = {
  RUNNING: { label: 'Running', color: '#16a34a', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', bg: 'bg-green-500/10' },
  IDLE: { label: 'Idle', color: '#d97706', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/10' },
  STOPPED: { label: 'Stopped', color: '#ea580c', dot: 'bg-orange-600', text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-500/10' },
  FAULT: { label: 'Fault', color: '#dc2626', dot: 'bg-red-600', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-500/10' },
  OFFLINE: { label: 'Offline', color: '#9ca3af', dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-500/10' },
}

const SHIFT_SLOT = { A: 0, B: 1, C: 2 }

export function useChartTheme() {
  const { dark } = useTheme()
  const series = dark ? SERIES.dark : SERIES.light
  return {
    dark,
    series,
    shift: (code) => series[SHIFT_SLOT[code] ?? 3],
    muted: dark ? '#4b5563' : '#d1d5db',
    text: dark ? '#9ca3af' : '#6b7280',
    grid: dark ? 'rgba(55,65,81,0.6)' : '#f3f4f6',
    surface: dark ? '#1f2937' : '#ffffff',
    tooltip: {
      backgroundColor: dark ? '#374151' : '#ffffff',
      titleColor: dark ? '#f3f4f6' : '#1f2937',
      bodyColor: dark ? '#d1d5db' : '#4b5563',
      borderColor: dark ? '#4b5563' : '#e5e7eb',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      boxPadding: 4,
      usePointStyle: true,
    },
  }
}

/** Shared axis styling: recessive grid, no axis lines, muted ticks. */
export function axes(t, { yTitle, xTitle, yMin, yMax, stacked = false } = {}) {
  const base = {
    border: { display: false },
    ticks: { color: t.text },
    grid: { color: t.grid },
  }
  return {
    x: { ...base, grid: { display: false }, stacked, title: xTitle ? { display: true, text: xTitle, color: t.text } : undefined },
    y: {
      ...base,
      stacked,
      min: yMin,
      max: yMax,
      beginAtZero: yMin === undefined,
      title: yTitle ? { display: true, text: yTitle, color: t.text } : undefined,
    },
  }
}

export function legend(t, show = true) {
  return {
    display: show,
    position: 'top',
    align: 'end',
    labels: { color: t.text, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 14 },
  }
}
