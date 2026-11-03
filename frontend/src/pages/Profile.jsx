import { useEffect, useState } from 'react'
import { Building2, KeyRound, Radio, Save, Clock, UserCog, BadgeCheck, Copy } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { fmtDateTime, initials, ago } from '../lib/format.js'
import { Alert, Spinner } from '../components/ui.jsx'
import { useChartTheme } from '../charts/chartTheme.js'
import { usePlantClock } from '../context/LiveContext.jsx'

function Section({ icon: Icon, title, subtitle, children, action }) {
  return (
    <section className="card">
      <header className="card-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center">
            <Icon className="w-[18px] h-[18px]" />
          </div>
          <div>
            <h2 className="card-title">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="form-label">{label}</span>
      {children}
    </label>
  )
}

function useStatus() {
  const [msg, setMsg] = useState(null)
  const ok = (text) => {
    setMsg({ kind: 'success', text })
    setTimeout(() => setMsg(null), 3000)
  }
  const fail = (text) => setMsg({ kind: 'error', text })
  return [msg, ok, fail]
}

function PersonalForm() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState(user)
  const [busy, setBusy] = useState(false)
  const [msg, ok, fail] = useStatus()
  useEffect(() => setForm(user), [user])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      setUser(await api('/profile/me', { method: 'PUT', body: form }))
      ok('Profile updated')
    } catch (err) {
      fail(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full name"><input className="form-input" value={form.fullName || ''} onChange={set('fullName')} required /></Field>
        <Field label="Username"><input className="form-input" value={form.username || ''} disabled /></Field>
        <Field label="Email"><input type="email" className="form-input" value={form.email || ''} onChange={set('email')} /></Field>
        <Field label="Mobile (used for OTP login)">
          <input className="form-input" inputMode="numeric" maxLength={10} value={form.mobile || ''} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Designation"><input className="form-input" value={form.designation || ''} onChange={set('designation')} /></Field>
        <Field label="Department"><input className="form-input" value={form.department || ''} onChange={set('department')} /></Field>
        <Field label="Employee ID"><input className="form-input" value={form.employeeId || ''} disabled /></Field>
        <Field label="Assigned shift">
          <select className="form-select" value={form.assignedShift || ''} onChange={set('assignedShift')}>
            <option value="General">General</option>
            <option value="A">Shift A</option>
            <option value="B">Shift B</option>
            <option value="C">Shift C</option>
          </select>
        </Field>
      </div>
      <div className="flex justify-end">
        <button className="btn-brand" disabled={busy}>{busy ? <Spinner /> : <Save className="w-4 h-4" />} Save changes</button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [msg, ok, fail] = useStatus()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    if (form.newPassword !== form.confirm) return fail('New passwords do not match')
    setBusy(true)
    try {
      await api('/profile/password', { method: 'PUT', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } })
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
      ok('Password changed')
    } catch (err) {
      fail(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <Field label="Current password"><input type="password" autoComplete="current-password" className="form-input" value={form.currentPassword} onChange={set('currentPassword')} required /></Field>
      <Field label="New password"><input type="password" autoComplete="new-password" minLength={6} className="form-input" value={form.newPassword} onChange={set('newPassword')} required /></Field>
      <Field label="Confirm new password"><input type="password" autoComplete="new-password" className="form-input" value={form.confirm} onChange={set('confirm')} required /></Field>
      <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : <KeyRound className="w-4 h-4" />} Update password</button>
    </form>
  )
}

const PLANT_FIELDS = [
  ['companyName', 'Company name'],
  ['plantName', 'Plant name'],
  ['plantCode', 'Plant code'],
  ['industry', 'Industry'],
  ['plantManager', 'Plant manager'],
  ['gstin', 'GSTIN'],
  ['address', 'Address', 'sm:col-span-2'],
  ['city', 'City'],
  ['state', 'State'],
  ['pincode', 'PIN code'],
  ['country', 'Country'],
  ['contactEmail', 'Contact email'],
  ['contactPhone', 'Contact phone'],
  ['establishedYear', 'Established', '', 'number'],
  ['installedSpindles', 'Installed spindles', '', 'number'],
  ['workforce', 'Workforce', '', 'number'],
  ['powerSanctionedKw', 'Sanctioned load (kW)', '', 'number'],
  ['certifications', 'Certifications', 'sm:col-span-2'],
]

function PlantForm({ admin }) {
  const [plant, setPlant] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, ok, fail] = useStatus()
  useEffect(() => {
    api('/profile/plant').then(setPlant).catch((e) => fail(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      setPlant(await api('/profile/plant', { method: 'PUT', body: plant }))
      ok('Plant details saved')
    } catch (err) {
      fail(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!plant) return <Spinner />
  return (
    <form onSubmit={save} className="space-y-4">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {!admin && <p className="text-xs text-gray-500 dark:text-gray-400">Only administrators can edit plant details.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANT_FIELDS.map(([key, label, span = '', type = 'text']) => (
          <Field key={key} label={label} className={span}>
            <input
              type={type}
              className="form-input"
              value={plant[key] ?? ''}
              disabled={!admin}
              onChange={(e) => setPlant({ ...plant, [key]: type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value })}
            />
          </Field>
        ))}
      </div>
      {admin && (
        <div className="flex justify-end">
          <button className="btn-brand" disabled={busy}>{busy ? <Spinner /> : <Save className="w-4 h-4" />} Save plant details</button>
        </div>
      )}
    </form>
  )
}

function ShiftTable({ admin }) {
  const t = useChartTheme()
  const [rows, setRows] = useState([])
  const [msg, ok, fail] = useStatus()
  useEffect(() => {
    api('/shifts').then(setRows).catch((e) => fail(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const update = (code, k, v) => setRows(rows.map((r) => (r.code === code ? { ...r, [k]: v } : r)))
  const save = async (r) => {
    try {
      await api(`/shifts/${r.code}`, { method: 'PUT', body: { name: r.name, startTime: r.startTime.slice(0, 5), endTime: r.endTime.slice(0, 5), color: r.color, inCharge: r.inCharge } })
      ok(`Shift ${r.code} saved`)
    } catch (e) {
      fail(e.message)
    }
  }
  return (
    <div className="space-y-3">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 text-left">
            <tr>
              <th className="py-2 pr-3">Shift</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Start</th>
              <th className="py-2 pr-3">End</th>
              <th className="py-2 pr-3">In-charge</th>
              {admin && <th />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="py-2 pr-3 font-semibold text-gray-800 dark:text-gray-100">
                  <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: t.shift(r.code) }} />{r.code}</span>
                </td>
                <td className="py-2 pr-3"><input className="form-input" value={r.name} disabled={!admin} onChange={(e) => update(r.code, 'name', e.target.value)} /></td>
                <td className="py-2 pr-3"><input type="time" className="form-input" value={r.startTime.slice(0, 5)} disabled={!admin} onChange={(e) => update(r.code, 'startTime', e.target.value)} /></td>
                <td className="py-2 pr-3"><input type="time" className="form-input" value={r.endTime.slice(0, 5)} disabled={!admin} onChange={(e) => update(r.code, 'endTime', e.target.value)} /></td>
                <td className="py-2 pr-3"><input className="form-input" value={r.inCharge || ''} disabled={!admin} onChange={(e) => update(r.code, 'inCharge', e.target.value)} /></td>
                {admin && (
                  <td className="py-2"><button type="button" className="btn-outline !py-1.5" onClick={() => save(r)}><Save className="w-4 h-4" /></button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IotPanel({ admin }) {
  const [status, setStatus] = useState(null)
  const [msg, ok, fail] = useStatus()
  const now = usePlantClock()
  const load = () => api('/iot/status').then(setStatus).catch((e) => fail(e.message))
  useEffect(() => {
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSim = async () => {
    try {
      await api('/iot/simulator', { method: 'PUT', body: { enabled: !status.simulatorEnabled } })
      ok(`Simulator ${status.simulatorEnabled ? 'stopped' : 'started'}`)
      load()
    } catch (e) {
      fail(e.message)
    }
  }

  const sample = `curl -X POST ${window.location.origin}/api/iot/telemetry \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Key: <device key>" \\
  -d '{"machineCode":"RF-01","status":"RUNNING","speed":18200,
       "cvPercent":11.4,"temperature":33.2,"humidity":56,
       "powerKw":29.5,"vibration":2.8,"productionKg":0.03,
       "rejectKg":0.0002,"breaks":0,"operatorName":"Murugan K"}'`

  if (!status) return <Spinner />
  return (
    <div className="space-y-5">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Gateways online', `${status.machinesOnline} / ${status.machinesTotal}`],
          ['Device-fed machines', status.deviceFed],
          ['Offline after', `${status.offlineAfterSeconds}s silence`],
          ['Auth header', status.authHeader],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2.5">
            <div className="text-[11px] uppercase font-semibold text-gray-400 dark:text-gray-500">{k}</div>
            <div className="text-base font-semibold text-gray-800 dark:text-gray-100">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700/60 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Built-in telemetry simulator</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Feeds machines that have no physical gateway. It steps aside automatically for any machine a device reports for.</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={status.simulatorEnabled}
          disabled={!admin}
          onClick={toggleSim}
          className={`relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-50 ${status.simulatorEnabled ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition ${status.simulatorEnabled ? 'translate-x-5' : ''}`} />
          <span className="sr-only">Toggle simulator</span>
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Connect a device / PLC gateway</div>
          <button type="button" className="text-xs text-brand-500 inline-flex items-center gap-1" onClick={() => navigator.clipboard?.writeText(sample)}>
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
        </div>
        <pre className="text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">{sample}</pre>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Batch upload: <code>POST {status.batchEndpoint}</code> with a JSON array of up to 500 readings. Ask an administrator for the device key.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {status.devices.map((d) => (
          <div key={d.code} className="rounded-lg border border-gray-200 dark:border-gray-700/60 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
              <span className={`w-2 h-2 rounded-full ${d.online ? 'bg-green-500' : 'bg-gray-400'}`} />
              {d.code}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              {d.online ? 'Online' : 'Offline'} · {d.source === 'DEVICE' ? 'device' : 'sim'} · {d.lastSeen ? ago(d.lastSeen, now) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const admin = user?.role === 'ADMIN'
  return (
    <>
      <div className="card p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white text-2xl font-bold flex items-center justify-center shrink-0">
          {initials(user?.fullName)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{user?.fullName}</h1>
          <div className="text-sm text-gray-500 dark:text-gray-400">{user?.designation} · {user?.department}</div>
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300 font-semibold"><BadgeCheck className="w-3.5 h-3.5" /> {user?.role}</span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">ID {user?.employeeId}</span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Shift {user?.assignedShift}</span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Last login {fmtDateTime(user?.lastLoginAt)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2">
          <Section icon={UserCog} title="Personal details" subtitle="Your account and contact information">
            <PersonalForm />
          </Section>
        </div>
        <Section icon={KeyRound} title="Security" subtitle="Change your sign-in password">
          <PasswordForm />
        </Section>
      </div>

      <div className="space-y-6">
        <Section icon={Building2} title="Plant & industrial details" subtitle="Company, site and statutory information">
          <PlantForm admin={admin} />
        </Section>
        <Section icon={Clock} title="Shift configuration" subtitle="Shift timings drive every shift-wise calculation">
          <ShiftTable admin={admin} />
        </Section>
        <Section icon={Radio} title="IoT connectivity" subtitle="How machines and gateways stream data into the platform">
          <IotPanel admin={admin} />
        </Section>
      </div>
    </>
  )
}
