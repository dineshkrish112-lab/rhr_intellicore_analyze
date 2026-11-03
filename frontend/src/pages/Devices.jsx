import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Cpu, MonitorSmartphone, Router, Server, Thermometer, Plug, PlugZap, Pencil, Trash2, X, Save, ArrowRight,
  Radio, Network, Gauge, CheckCircle2, XCircle, KeyRound, RefreshCw,
} from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { usePlantClock } from '../context/LiveContext.jsx'
import { ago } from '../lib/format.js'
import { Alert, Empty, PageTitle, Segmented, Spinner } from '../components/ui.jsx'

const TYPES = [
  { key: 'PLC', label: 'PLC', hint: 'Siemens, Delta, Allen-Bradley…', icon: Cpu },
  { key: 'HMI', label: 'HMI', hint: 'Operator touch panel', icon: MonitorSmartphone },
  { key: 'IOT_GATEWAY', label: 'IoT gateway', hint: 'Publishes many machines', icon: Router },
  { key: 'EDGE_PC', label: 'Edge PC / server', hint: 'OPC UA, SCADA', icon: Server },
  { key: 'SENSOR', label: 'Sensor / meter', hint: 'Energy, humidity, vibration', icon: Thermometer },
]
const TYPE = Object.fromEntries(TYPES.map((t) => [t.key, t]))

const PROTOCOL_STYLE = {
  MQTT: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  MODBUS_TCP: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  OPC_UA: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
  HTTP_PUSH: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}
const PROTOCOL_LABEL = { MQTT: 'MQTT', MODBUS_TCP: 'Modbus TCP', OPC_UA: 'OPC UA', HTTP_PUSH: 'HTTP push' }

const STATE = {
  CONNECTED: { label: 'Connected', cls: 'bg-green-500/10 text-green-700 dark:text-green-400', dot: 'bg-green-500 animate-pulse' },
  RECEIVING: { label: 'Receiving', cls: 'bg-green-500/10 text-green-700 dark:text-green-400', dot: 'bg-green-500 animate-pulse' },
  REACHABLE: { label: 'Reachable', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400', dot: 'bg-sky-500' },
  CONNECTING: { label: 'Connecting', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500 animate-pulse' },
  RECONNECTING: { label: 'Reconnecting', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500 animate-pulse' },
  WAITING: { label: 'Waiting for data', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  SILENT: { label: 'Silent', cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  ERROR: { label: 'Error', cls: 'bg-red-500/10 text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  UNREACHABLE: { label: 'Unreachable', cls: 'bg-red-500/10 text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  DISABLED: { label: 'Disabled', cls: 'bg-gray-500/10 text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
}
const HEALTHY = ['CONNECTED', 'RECEIVING', 'REACHABLE']
const PROBLEM = ['ERROR', 'UNREACHABLE', 'SILENT']

const REGISTER_FIELDS = [
  ['status', 'Run status (0 stop · 1 run · 2 idle · 3 fault)'],
  ['speed', 'Speed'],
  ['cvPercent', 'CV %'],
  ['temperature', 'Temperature °C'],
  ['humidity', 'Humidity %RH'],
  ['powerKw', 'Power kW'],
  ['vibration', 'Vibration mm/s'],
  ['productionCounter', 'Production counter (kg, cumulative)'],
  ['rejectCounter', 'Reject counter (kg, cumulative)'],
  ['breaksCounter', 'End-break counter (cumulative)'],
  ['productionKg', 'Production since last poll (kg)'],
]

const EMPTY = {
  name: '', deviceType: 'PLC', protocol: 'MODBUS_TCP', make: '', model: '', location: '', notes: '',
  host: '', port: 502, machineId: null, enabled: false,
  mqttTopic: 'rhr/plant1/+/telemetry', mqttClientId: '', mqttQos: 1, useTls: false, username: '', password: '',
  modbusUnitId: 1, pollIntervalSec: 5, registerMap: '', opcEndpointPath: '', opcNodeMap: '',
}

function parseRegisters(json) {
  try {
    const o = json ? JSON.parse(json) : {}
    return Object.entries(o).map(([field, v]) => ({ field, address: v.address ?? 0, scale: v.scale ?? 1 }))
  } catch {
    return []
  }
}

function serializeRegisters(rows) {
  if (!rows.length) return ''
  const o = {}
  rows.forEach((r) => {
    o[r.field] = r.scale === 1 || r.scale === '' ? { address: Number(r.address) } : { address: Number(r.address), scale: Number(r.scale) }
  })
  return JSON.stringify(o)
}

function StatePill({ state }) {
  const s = STATE[state] || STATE.DISABLED
  return (
    <span className={`chip ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
    </span>
  )
}

function endpoint(d) {
  if (d.protocol === 'HTTP_PUSH') return 'POST /api/iot/telemetry'
  const scheme = { MQTT: d.useTls ? 'mqtts' : 'mqtt', MODBUS_TCP: 'modbus', OPC_UA: 'opc.tcp' }[d.protocol]
  return `${scheme}://${d.host}:${d.port}${d.protocol === 'OPC_UA' && d.opcEndpointPath ? d.opcEndpointPath : ''}`
}

// ---------------------------------------------------------------- form drawer

function Section({ step, title, hint, children }) {
  return (
    <section className="py-5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-start gap-3 mb-4">
        <span className="num w-6 h-6 rounded-md bg-brand-600 dark:bg-brand-500/20 text-white dark:text-brand-300 text-xs font-bold flex items-center justify-center shrink-0">{step}</span>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-gray-50">{title}</h3>
          {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
      </div>
      <div className="pl-9">{children}</div>
    </section>
  )
}

function Field({ label, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="form-label">{label}</span>
      {children}
      {hint && <span className="form-hint block">{hint}</span>}
    </label>
  )
}

function DeviceDrawer({ initial, protocols, machines, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial, password: '' }))
  const [registers, setRegisters] = useState(() => parseRegisters(initial?.registerMap))
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState(null)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))
  const proto = protocols.find((p) => p.key === form.protocol)

  const payload = () => ({
    ...form,
    id: initial?.id,
    port: form.port === '' ? null : Number(form.port),
    machineId: form.machineId ? Number(form.machineId) : null,
    mqttQos: Number(form.mqttQos),
    modbusUnitId: Number(form.modbusUnitId),
    pollIntervalSec: Number(form.pollIntervalSec),
    registerMap: form.protocol === 'MODBUS_TCP' ? serializeRegisters(registers) : form.registerMap,
  })

  const chooseProtocol = (key) => {
    const p = protocols.find((x) => x.key === key)
    setForm((f) => ({ ...f, protocol: key, port: key === 'HTTP_PUSH' ? null : p?.defaultPort ?? f.port }))
    setTest(null)
  }

  const runTest = async () => {
    setTesting(true)
    setTest(null)
    try {
      setTest(await api('/devices/test', { method: 'POST', body: payload() }))
    } catch (e) {
      setTest({ ok: false, message: e.message })
    } finally {
      setTesting(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = initial?.id
        ? await api(`/devices/${initial.id}`, { method: 'PUT', body: payload() })
        : await api('/devices', { method: 'POST', body: payload() })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={initial?.id ? 'Edit device' : 'Add device'}>
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={save} className="relative w-full max-w-2xl h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="eyebrow">{initial?.id ? 'Edit connection' : 'New connection'}</div>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">{form.name || 'Untitled device'}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost !p-2" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6">
          <Section step="1" title="What is the device?" hint="Name it the way operators refer to it on the floor.">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              {TYPES.map(({ key, label, icon: Icon }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => set('deviceType')(key)}
                  className={`rounded-xl border p-3 text-left transition ${form.deviceType === key ? 'border-brand-500 bg-brand-500/5 ring-4 ring-brand-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                  aria-pressed={form.deviceType === key}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${form.deviceType === key ? 'text-brand-600' : 'text-gray-400'}`} />
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-100">{label}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Device name" className="sm:col-span-2"><input className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. RF-02 Siemens PLC" required /></Field>
              <Field label="Make"><input className="form-input" value={form.make || ''} onChange={set('make')} placeholder="Siemens" /></Field>
              <Field label="Model"><input className="form-input" value={form.model || ''} onChange={set('model')} placeholder="S7-1200" /></Field>
              <Field label="Location" className="sm:col-span-2"><input className="form-input" value={form.location || ''} onChange={set('location')} placeholder="Ring frame hall, panel 3" /></Field>
            </div>
          </Section>

          <Section step="2" title="How do we talk to it?" hint="Pick the protocol, then enter its network address.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {protocols.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => chooseProtocol(p.key)}
                  className={`rounded-xl border p-3 text-left transition ${form.protocol === p.key ? 'border-brand-500 bg-brand-500/5 ring-4 ring-brand-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                  aria-pressed={form.protocol === p.key}
                >
                  <div className="flex items-center justify-between">
                    <span className={`chip ${PROTOCOL_STYLE[p.key]}`}>{p.label}</span>
                    {p.key !== 'HTTP_PUSH' && <span className="num text-[11px] text-gray-400">:{p.defaultPort}</span>}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">{p.description}</p>
                </button>
              ))}
            </div>
            {form.protocol !== 'HTTP_PUSH' && (
              <div className="grid grid-cols-3 gap-4">
                <Field label={form.protocol === 'MQTT' ? 'Broker IP / host' : 'IP address / host'} className="col-span-2">
                  <input className="form-input num" value={form.host || ''} onChange={set('host')} placeholder="192.168.10.21" required />
                </Field>
                <Field label="Port">
                  <input className="form-input num" type="number" min="1" max="65535" value={form.port ?? ''} onChange={set('port')} required />
                </Field>
              </div>
            )}
            {(form.protocol === 'MQTT' || form.protocol === 'OPC_UA') && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Field label="Username"><input className="form-input" autoComplete="off" value={form.username || ''} onChange={set('username')} /></Field>
                <Field label="Password" hint={initial?.id && initial.hasPassword ? 'Leave blank to keep the saved password' : undefined}>
                  <input className="form-input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
                </Field>
              </div>
            )}
          </Section>

          <Section step="3" title={`${PROTOCOL_LABEL[form.protocol]} settings`} hint={proto?.description}>
            {form.protocol === 'MQTT' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Topic to subscribe" className="col-span-2" hint="Wildcards allowed: + one level, # many levels">
                    <input className="form-input num" value={form.mqttTopic || ''} onChange={set('mqttTopic')} required />
                  </Field>
                  <Field label="QoS">
                    <select className="form-select" value={form.mqttQos} onChange={set('mqttQos')}>
                      <option value={0}>0 · at most once</option>
                      <option value={1}>1 · at least once</option>
                      <option value={2}>2 · exactly once</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4 items-end">
                  <Field label="Client ID" hint="Blank = generated"><input className="form-input num" value={form.mqttClientId || ''} onChange={set('mqttClientId')} /></Field>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 pb-2">
                    <input type="checkbox" checked={form.useTls} onChange={set('useTls')} className="rounded" /> Use TLS (mqtts, usually :8883)
                  </label>
                </div>
                <div>
                  <div className="form-label">Expected payload</div>
                  <pre className="num text-[11px] leading-relaxed bg-gray-900 text-sky-100 rounded-xl p-3 overflow-x-auto">{`{"machineCode":"RF-01","status":"RUNNING","speed":18200,"cvPercent":11.4,
 "temperature":33.2,"humidity":56,"powerKw":29.5,"productionKg":0.03}`}</pre>
                  <p className="form-hint">machineCode can be left out when the device is mapped to one machine below. Arrays of readings are accepted.</p>
                </div>
              </div>
            )}

            {form.protocol === 'MODBUS_TCP' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Unit / slave ID" hint="0-247, usually 1"><input className="form-input num" type="number" min="0" max="247" value={form.modbusUnitId} onChange={set('modbusUnitId')} /></Field>
                  <Field label="Poll every (seconds)"><input className="form-input num" type="number" min="1" max="3600" value={form.pollIntervalSec} onChange={set('pollIntervalSec')} /></Field>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="form-label !mb-0">Holding register map</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-600 inline-flex items-center gap-1"
                      onClick={() => {
                        const used = registers.map((r) => r.field)
                        const next = REGISTER_FIELDS.find(([f]) => !used.includes(f))
                        if (next) setRegisters([...registers, { field: next[0], address: registers.length, scale: 1 }])
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add register
                    </button>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="grid grid-cols-[1fr_6rem_6rem_2.5rem] gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 eyebrow">
                      <span>Value</span><span>Address</span><span>Scale ×</span><span />
                    </div>
                    {registers.length === 0 && <div className="px-3 py-4 text-xs text-gray-400">No registers mapped yet. A test will only check the TCP connection.</div>}
                    {registers.map((r, i) => (
                      <div key={i} className="grid grid-cols-[1fr_6rem_6rem_2.5rem] gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-800 items-center">
                        <select className="form-select !py-1.5" value={r.field} onChange={(e) => setRegisters(registers.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}>
                          {REGISTER_FIELDS.map(([f, label]) => (
                            <option key={f} value={f} disabled={f !== r.field && registers.some((x) => x.field === f)}>{label}</option>
                          ))}
                        </select>
                        <input className="form-input num !py-1.5" type="number" min="0" max="65535" value={r.address} onChange={(e) => setRegisters(registers.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} aria-label="Register address" />
                        <input className="form-input num !py-1.5" type="number" step="any" value={r.scale} onChange={(e) => setRegisters(registers.map((x, j) => (j === i ? { ...x, scale: e.target.value } : x)))} aria-label="Scale" />
                        <button type="button" className="text-gray-400 hover:text-red-500" onClick={() => setRegisters(registers.filter((_, j) => j !== i))} aria-label="Remove register">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="form-hint">Addresses are 0-based holding registers (40001 = 0). Example: CV% stored as 1142 with scale 0.01 reads as 11.42.</p>
                </div>
              </div>
            )}

            {form.protocol === 'OPC_UA' && (
              <div className="space-y-4">
                <Field label="Endpoint path" hint="Appended to opc.tcp://host:port"><input className="form-input num" value={form.opcEndpointPath || ''} onChange={set('opcEndpointPath')} placeholder="/OPCUA/Server" /></Field>
                <Field label="Node map (JSON)" hint='e.g. {"speed":"ns=2;s=RF01.Speed"}'>
                  <textarea className="form-textarea num text-xs" rows={3} value={form.opcNodeMap || ''} onChange={set('opcNodeMap')} />
                </Field>
                <Alert kind="success">The endpoint is monitored for reachability. Publish its values through an MQTT or HTTP edge gateway to feed machine data.</Alert>
              </div>
            )}

            {form.protocol === 'HTTP_PUSH' && (
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p>The device sends readings to us, so no address is needed. After saving you get a device key to put in the <span className="num">X-Device-Key</span> header.</p>
                <pre className="num text-[11px] bg-gray-900 text-sky-100 rounded-xl p-3 overflow-x-auto">{`POST ${window.location.origin}/api/iot/telemetry
X-Device-Key: ${initial?.apiKey || '<shown after saving>'}
{"machineCode":"RF-01","humidity":56.2,"temperature":31.8}`}</pre>
              </div>
            )}
          </Section>

          <Section step="4" title="Which machine does it feed?" hint="Readings without a machineCode are booked against this machine.">
            <select className="form-select" value={form.machineId ?? ''} onChange={set('machineId')}>
              <option value="">Not mapped (payload names the machine)</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.code} · {m.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 mt-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
              <input type="checkbox" checked={form.enabled} onChange={set('enabled')} className="rounded" />
              Start the connector when saved
            </label>
            <p className="form-hint">While a device is sending data for a machine, the built-in simulator stops generating data for it.</p>
          </Section>
        </div>

        <footer className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          {test && (
            <div className={`flex items-start gap-2 text-sm rounded-xl px-3 py-2 ${test.ok ? 'bg-green-500/10 text-green-800 dark:text-green-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}>
              {test.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>
                {test.message}
                {test.latencyMs != null && <span className="num ml-1 opacity-70">({test.latencyMs} ms)</span>}
              </span>
            </div>
          )}
          {error && <Alert>{error}</Alert>}
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="btn-outline" onClick={runTest} disabled={testing}>
              {testing ? <Spinner /> : <PlugZap className="w-4 h-4" />} Test connection
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-brand" disabled={busy}>{busy ? <Spinner /> : <Save className="w-4 h-4" />} Save device</button>
            </div>
          </div>
        </footer>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------- page

function DeviceCard({ view, admin, now, onEdit, onToggle, onDelete, onTest, onRegenerate }) {
  const d = view.device
  const rt = view.runtime
  const T = TYPE[d.deviceType] || TYPE.PLC
  const Icon = T.icon
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)

  const test = async () => {
    setTesting(true)
    setResult(await onTest(d.id))
    setTesting(false)
  }

  return (
    <article className="card p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 dark:bg-gray-800 dark:text-brand-300 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900 dark:text-white truncate">{d.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{T.label} · {[d.make, d.model].filter(Boolean).join(' ') || '—'}</p>
        </div>
        <StatePill state={rt.state} />
      </div>

      <div className="rounded-xl bg-gray-50 dark:bg-gray-950/50 border border-gray-100 dark:border-gray-800 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`chip ${PROTOCOL_STYLE[d.protocol]}`}>{PROTOCOL_LABEL[d.protocol]}</span>
          <span className="num text-xs text-gray-700 dark:text-gray-200 truncate">{endpoint(d)}</span>
        </div>
        <div className="num text-[11px] text-gray-500 mt-1.5 truncate">
          {d.protocol === 'MQTT' && <>topic {d.mqttTopic} · QoS {d.mqttQos ?? 1}</>}
          {d.protocol === 'MODBUS_TCP' && <>unit {d.modbusUnitId ?? 1} · every {d.pollIntervalSec ?? 5}s</>}
          {d.protocol === 'OPC_UA' && <>monitored every 30s</>}
          {d.protocol === 'HTTP_PUSH' && <>key {d.apiKey}</>}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="eyebrow">Feeds</dt>
          <dd className="font-semibold text-gray-800 dark:text-gray-100">{view.machineCode || 'By payload'}</dd>
        </div>
        <div>
          <dt className="eyebrow">Last data</dt>
          <dd className="font-semibold text-gray-800 dark:text-gray-100">{rt.lastMessageAt ? ago(rt.lastMessageAt, now) : '—'}</dd>
        </div>
        <div>
          <dt className="eyebrow">Messages</dt>
          <dd className="num font-semibold text-gray-800 dark:text-gray-100">{rt.messages}</dd>
        </div>
      </dl>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug min-h-[2rem]">{rt.message}</p>

      {result && (
        <div className={`text-xs rounded-lg px-3 py-2 ${result.ok ? 'bg-green-500/10 text-green-800 dark:text-green-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}>
          {result.message} {result.latencyMs != null && <span className="num">({result.latencyMs} ms)</span>}
        </div>
      )}

      {admin && (
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-800 mt-auto">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={d.enabled}
              onClick={() => onToggle(d)}
              className={`relative w-10 h-6 rounded-full transition ${d.enabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition ${d.enabled ? 'translate-x-4' : ''}`} />
              <span className="sr-only">Connector on</span>
            </button>
            {d.enabled ? 'On' : 'Off'}
          </label>
          <div className="flex gap-1">
            <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={test} disabled={testing} title="Test connection">
              {testing ? <Spinner /> : <Plug className="w-4 h-4" />} Test
            </button>
            {d.protocol === 'HTTP_PUSH' && (
              <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => onRegenerate(d)} title="New device key" aria-label="Regenerate device key">
                <KeyRound className="w-4 h-4" />
              </button>
            )}
            <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => onEdit(view)} aria-label="Edit device"><Pencil className="w-4 h-4" /></button>
            <button className="btn-ghost !px-2.5 !py-1.5 hover:!text-red-600" onClick={() => onDelete(d)} aria-label="Delete device"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </article>
  )
}

export default function Devices() {
  const { user } = useAuth()
  const admin = user?.role === 'ADMIN'
  const now = usePlantClock()
  const [views, setViews] = useState(null)
  const [protocols, setProtocols] = useState([])
  const [machines, setMachines] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => api('/devices').then(setViews).catch((e) => setError(e.message)), [])

  useEffect(() => {
    load()
    api('/devices/protocols').then(setProtocols).catch(() => {})
    api('/machines').then(setMachines).catch(() => {})
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  const counts = useMemo(() => {
    const list = views || []
    return {
      total: list.length,
      healthy: list.filter((v) => HEALTHY.includes(v.runtime.state)).length,
      problem: list.filter((v) => PROBLEM.includes(v.runtime.state)).length,
      off: list.filter((v) => !v.device.enabled).length,
    }
  }, [views])

  const list = (views || []).filter((v) => filter === 'ALL' || v.device.protocol === filter)

  const toggle = async (d) => {
    try {
      await api(`/devices/${d.id}/enabled`, { method: 'POST', body: { enabled: !d.enabled } })
      load()
    } catch (e) {
      setError(e.message)
    }
  }
  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.name}"? Its connector stops immediately.`)) return
    await api(`/devices/${d.id}`, { method: 'DELETE' }).catch((e) => setError(e.message))
    load()
  }
  const testSaved = (id) => api(`/devices/${id}/test`, { method: 'POST' }).catch((e) => ({ ok: false, message: e.message }))
  const regenerate = async (d) => {
    if (!window.confirm('Issue a new key? The device must be updated with it before it can send again.')) return
    await api(`/devices/${d.id}/regenerate-key`, { method: 'POST' }).catch((e) => setError(e.message))
    load()
  }

  return (
    <>
      <PageTitle
        title="Devices & Gateways"
        subtitle="Connect the PLCs, HMIs, MQTT gateways and OPC UA servers on your plant network. Every enabled device runs a live connector that feeds machine data into dashboards and reports."
      >
        <button className="btn-outline" onClick={load} aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
        {admin && (
          <button className="btn-brand" onClick={() => setEditing({})}>
            <Plus className="w-4 h-4" /> Add device
          </button>
        )}
      </PageTitle>

      {/* How data flows, so the page explains itself */}
      <div className="card overflow-hidden mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4">
          {[
            [Cpu, 'Field device', 'PLC, HMI, sensor or gateway on the machine'],
            [Network, 'Protocol', 'MQTT topic, Modbus registers, OPC UA or HTTP'],
            [Radio, 'Connector', 'Runs here, decodes values every few seconds'],
            [Gauge, 'Live data', 'Machine card, shift OEE, alarms, reports'],
          ].map(([Icon, title, text], i) => (
            <div key={title} className="relative flex items-center gap-3 px-5 py-4 border-b md:border-b-0 md:border-r last:border-0 border-gray-100 dark:border-gray-800">
              <span className="num text-[11px] font-bold text-gray-300 dark:text-gray-600">0{i + 1}</span>
              <Icon className="w-5 h-5 text-brand-600 dark:text-brand-300 shrink-0" />
              <div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">{title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{text}</div>
              </div>
              {i < 3 && <ArrowRight className="hidden md:block absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 p-0.5 rounded-full bg-white dark:bg-gray-900 text-gray-300 border border-gray-100 dark:border-gray-800" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          ['Registered devices', counts.total, 'text-gray-900 dark:text-white'],
          ['Healthy', counts.healthy, 'text-green-600 dark:text-green-400'],
          ['Need attention', counts.problem, counts.problem ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'],
          ['Switched off', counts.off, 'text-gray-500'],
        ].map(([label, value, cls]) => (
          <div key={label} className="card px-5 py-4">
            <div className="eyebrow">{label}</div>
            <div className={`num text-3xl font-semibold ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 overflow-x-auto no-scrollbar">
        <Segmented
          label="Protocol filter"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'ALL', label: 'All protocols' }, ...Object.entries(PROTOCOL_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        {!admin && <span className="text-xs text-gray-500 whitespace-nowrap">Only administrators can add or change devices.</span>}
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {!views ? (
        <div className="card"><Empty><Spinner /></Empty></div>
      ) : list.length === 0 ? (
        <div className="card"><Empty>No devices for this protocol yet.</Empty></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {list.map((v) => (
            <DeviceCard key={v.device.id} view={v} admin={admin} now={now} onEdit={(x) => setEditing({ ...x.device, hasPassword: x.hasPassword })} onToggle={toggle} onDelete={remove} onTest={testSaved} onRegenerate={regenerate} />
          ))}
        </div>
      )}

      {editing && (
        <DeviceDrawer
          initial={editing.id ? editing : null}
          protocols={protocols}
          machines={machines}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </>
  )
}

