import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, CircleSlash, PauseCircle, WifiOff, PlayCircle } from 'lucide-react'
import { STATUS } from '../charts/chartTheme.js'

const STATUS_ICON = {
  RUNNING: PlayCircle,
  IDLE: PauseCircle,
  STOPPED: CircleSlash,
  FAULT: AlertTriangle,
  OFFLINE: WifiOff,
}

export function StatusBadge({ status, size = 'sm' }) {
  const s = STATUS[status] || STATUS.OFFLINE
  const Icon = STATUS_ICON[status] || WifiOff
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${s.bg} ${s.text} ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'}`}>
      <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      {s.label}
    </span>
  )
}

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="lg:flex lg:justify-between lg:items-end gap-4 mb-6">
      <div className="mb-4 lg:mb-0 max-w-2xl">
        <h1 className="text-2xl md:text-[1.75rem] text-gray-900 dark:text-white font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Small (i) that explains a metric on hover / focus, so numbers are never unexplained. */
export function InfoTip({ text }) {
  return (
    <span className="relative group inline-flex align-middle">
      <button type="button" className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 text-[10px] font-bold leading-none text-gray-400 hover:text-brand-600 hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30" aria-label={text}>
        i
      </button>
      <span role="tooltip" className="pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 top-6 w-60 rounded-lg bg-ink-900 text-gray-100 text-xs font-medium leading-relaxed px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
        {text}
      </span>
    </span>
  )
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-1 rounded-xl bg-gray-200/60 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`tab ${value === o.value ? 'tab-active' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Spinner({ className = '' }) {
  return <span className={`inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin ${className}`} />
}

export function Alert({ kind = 'error', children }) {
  const styles =
    kind === 'error'
      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30'
      : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30'
  const Icon = kind === 'error' ? AlertTriangle : CheckCircle2
  return (
    <div className={`flex items-start gap-2 text-sm border rounded-lg px-3 py-2 ${styles}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function Empty({ children }) {
  return <div className="flex items-center justify-center h-full min-h-[8rem] text-sm text-gray-400 dark:text-gray-500">{children}</div>
}

/** Mosaic-style pagination: range summary, page-size picker and numbered pages. */
export function Pagination({ page, totalPages, totalElements, size, onPage, onSize }) {
  if (!totalElements) return null
  const from = page * size + 1
  const to = Math.min(totalElements, (page + 1) * size)
  const pages = []
  const add = (p) => pages.push(p)
  const span = 1
  for (let p = 0; p < totalPages; p++) {
    if (p === 0 || p === totalPages - 1 || Math.abs(p - page) <= span) add(p)
    else if (pages[pages.length - 1] !== '…') add('…')
  }
  const btn = 'inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2 text-sm font-medium rounded-lg border transition'
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-3">
        <span>
          Showing <span className="font-medium text-gray-700 dark:text-gray-300">{from}</span> to{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{to}</span> of{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{totalElements.toLocaleString('en-IN')}</span> results
        </span>
        {onSize && (
          <select className="form-select !w-auto !py-1" value={size} onChange={(e) => onSize(Number(e.target.value))} aria-label="Rows per page">
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
      </div>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          className={`${btn} border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40`}
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} ${
                p === page
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300'
              }`}
            >
              {p + 1}
            </button>
          ),
        )}
        <button
          className={`${btn} border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40`}
          disabled={page >= totalPages - 1}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </nav>
    </div>
  )
}

/** Horizontal meter for a live value against its limit. */
export function Meter({ value, max, warnAt, color = 'bg-brand-500' }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const over = warnAt != null && value > warnAt
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700/60 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : color}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}
