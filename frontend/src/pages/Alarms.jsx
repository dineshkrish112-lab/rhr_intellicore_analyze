import { useCallback, useEffect, useState } from 'react'
import { AlertOctagon, AlertTriangle, Info, CheckCheck, Check } from 'lucide-react'
import { api } from '../lib/api.js'
import { fmtDateTime } from '../lib/format.js'
import { useLive } from '../context/LiveContext.jsx'
import { Alert, Empty, PageTitle, Pagination, Segmented, Spinner } from '../components/ui.jsx'

const SEVERITY = {
  CRITICAL: { icon: AlertOctagon, label: 'Critical', cls: 'text-red-700 bg-red-500/10 dark:text-red-400' },
  WARNING: { icon: AlertTriangle, label: 'Warning', cls: 'text-amber-700 bg-amber-500/10 dark:text-amber-400' },
  INFO: { icon: Info, label: 'Info', cls: 'text-sky-700 bg-sky-500/10 dark:text-sky-400' },
}

export default function Alarms() {
  const { setActiveAlarms } = useLive()
  const [status, setStatus] = useState('active')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    return api('/alarms', { params: { status, page, size } })
      .then((d) => {
        setData(d)
        setActiveAlarms(d.activeCount)
        setError('')
      })
      .catch((e) => setError(e.message))
  }, [status, page, size, setActiveAlarms])

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  const ack = async (id) => {
    await api(`/alarms/${id}/ack`, { method: 'POST' }).catch((e) => setError(e.message))
    load()
  }

  const ackAll = async () => {
    setBusy(true)
    await api('/alarms/ack-all', { method: 'POST' }).catch((e) => setError(e.message))
    setBusy(false)
    setPage(0)
    load()
  }

  return (
    <>
      <PageTitle title="Alarms & Events" subtitle="Threshold breaches, faults and lost gateways">
        <Segmented
          label="Alarm filter"
          value={status}
          onChange={(s) => {
            setStatus(s)
            setPage(0)
          }}
          options={[
            { value: 'active', label: `Active${data ? ` (${data.activeCount})` : ''}` },
            { value: 'all', label: 'History' },
          ]}
        />
        <button className="btn-brand" onClick={ackAll} disabled={busy || !data?.activeCount}>
          {busy ? <Spinner /> : <CheckCheck className="w-4 h-4" />} Acknowledge all
        </button>
      </PageTitle>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <section className="card">
        {!data ? (
          <Empty><Spinner /></Empty>
        ) : data.content.length === 0 ? (
          <Empty>{status === 'active' ? 'No active alarms. All machines within limits.' : 'No alarm history'}</Empty>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {data.content.map((a) => {
              const s = SEVERITY[a.severity] || SEVERITY.INFO
              const Icon = s.icon
              return (
                <li key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full w-fit ${s.cls}`}>
                    <Icon className="w-3.5 h-3.5" /> {s.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 dark:text-gray-100">
                      <span className="font-semibold">{a.machineCode}</span> · {a.message}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {a.type.replace('_', ' ')} · {fmtDateTime(a.ts)}
                      {a.acknowledged && ` · acknowledged by ${a.acknowledgedBy} at ${fmtDateTime(a.acknowledgedAt)}`}
                    </div>
                  </div>
                  {!a.acknowledged ? (
                    <button className="btn-outline !py-1.5" onClick={() => ack(a.id)}>
                      <Check className="w-4 h-4" /> Acknowledge
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Closed</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {data && (
          <div className="border-t border-gray-100 dark:border-gray-700/60">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              totalElements={data.totalElements}
              size={size}
              onPage={setPage}
              onSize={(n) => {
                setSize(n)
                setPage(0)
              }}
            />
          </div>
        )}
      </section>
    </>
  )
}
