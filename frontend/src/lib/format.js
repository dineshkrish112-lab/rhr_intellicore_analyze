const nf = (d) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })
const nf0 = nf(0)
const nf1 = nf(1)
const nf2 = nf(2)

export const fmt0 = (v) => (v == null || Number.isNaN(v) ? '–' : nf0.format(v))
export const fmt1 = (v) => (v == null || Number.isNaN(v) ? '–' : nf1.format(v))
export const fmt2 = (v) => (v == null || Number.isNaN(v) ? '–' : nf2.format(v))
export const pct = (v) => (v == null ? '–' : `${nf1.format(v)}%`)

export function fmtKg(v) {
  if (v == null) return '–'
  return v >= 10000 ? `${nf1.format(v / 1000)} t` : `${nf0.format(v)} kg`
}

/** Server sends plant-local timestamps without an offset; treat them as wall-clock values. */
export function parseLocal(iso) {
  if (!iso) return null
  return new Date(iso.length > 23 ? iso.slice(0, 23) : iso)
}

export function fmtTime(iso) {
  const d = parseLocal(iso)
  return d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '–'
}

export function fmtDateTime(iso) {
  const d = parseLocal(iso)
  return d
    ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    : '–'
}

export function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function ago(iso, nowMs) {
  const d = parseLocal(iso)
  if (!d) return 'never'
  const s = Math.max(0, Math.round((nowMs - d.getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function isoDate(d) {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}
