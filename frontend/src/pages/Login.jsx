import { useState } from 'react'
import { Eye, EyeOff, Smartphone, User, Moon, Sun, Gauge, Radio, FileDown, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { Logo } from '../components/Sidebar.jsx'
import { Alert, Segmented, Spinner } from '../components/ui.jsx'

function PasswordForm() {
  const { loginWithPassword } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await loginWithPassword(username, password)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div>
        <label className="form-label" htmlFor="username">Username</label>
        <input id="username" className="form-input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
      </div>
      <div>
        <label className="form-label" htmlFor="password">Password</label>
        <div className="relative">
          <input
            id="password"
            type={show ? 'text' : 'password'}
            className="form-input pr-10"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="submit" className="btn-brand w-full py-2.5" disabled={busy}>
        {busy && <Spinner />} Sign in
      </button>
    </form>
  )
}

function OtpForm() {
  const { requestOtp, verifyOtp } = useAuth()
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async (e) => {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      setChallenge(await requestOtp(mobile))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await verifyOtp(mobile, otp)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (!challenge) {
    return (
      <form onSubmit={send} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div>
          <label className="form-label" htmlFor="mobile">Registered mobile number</label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">+91</span>
            <input
              id="mobile"
              className="form-input rounded-l-none"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              pattern="\d{10}"
              placeholder="10 digit number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
          </div>
        </div>
        <button type="submit" className="btn-brand w-full py-2.5" disabled={busy || mobile.length !== 10}>
          {busy && <Spinner />} Send OTP
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Alert kind="success">
        {challenge.message} <span className="font-semibold">+91 {challenge.maskedMobile}</span>
      </Alert>
      <div>
        <label className="form-label" htmlFor="otp">Enter 6 digit OTP</label>
        <input
          id="otp"
          className="form-input text-center text-lg tracking-[0.6em] font-semibold"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          required
          autoFocus
        />
      </div>
      <button type="submit" className="btn-brand w-full py-2.5" disabled={busy || otp.length !== 6}>
        {busy && <Spinner />} Verify &amp; sign in
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={() => { setChallenge(null); setOtp('') }}>
          Change number
        </button>
        <button type="button" className="text-brand-500 hover:text-brand-600 font-medium" onClick={send} disabled={busy}>
          Resend OTP
        </button>
      </div>
    </form>
  )
}

const FEATURES = [
  { icon: Radio, title: 'Live machine telemetry', text: 'CV%, speed, temperature and energy streamed from every machine.' },
  { icon: Gauge, title: 'Shift-wise OEE', text: 'Availability, performance and quality for shifts A, B and C.' },
  { icon: FileDown, title: 'PDF & Excel reports', text: 'Daily, monthly and yearly production registers on demand.' },
]

export default function Login() {
  const [mode, setMode] = useState('password')
  const { dark, toggle } = useTheme()

  return (
    <main className="bg-white dark:bg-gray-900 min-h-[100dvh] flex">
      <div className="w-full md:w-1/2 flex flex-col">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <Logo />
          <button onClick={toggle} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" aria-label="Toggle theme">
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex-1 flex items-center px-4 py-8">
          <div className="max-w-sm w-full mx-auto">
            <h1 className="text-3xl text-gray-800 dark:text-gray-100 font-bold mb-2">Welcome back</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Sign in to the plant monitoring console.</p>

            <div className="mb-6">
              <Segmented
                label="Sign-in method"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'password', label: <span className="inline-flex items-center gap-1.5"><User className="w-4 h-4" />Username</span> },
                  { value: 'otp', label: <span className="inline-flex items-center gap-1.5"><Smartphone className="w-4 h-4" />Mobile OTP</span> },
                ]}
              />
            </div>

            {mode === 'password' ? <PasswordForm /> : <OtpForm />}

            <div className="mt-8 pt-5 border-t border-gray-100 dark:border-gray-700/60">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 mb-2">
                <ShieldCheck className="w-4 h-4" /> Static plant accounts
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div><span className="font-medium text-gray-700 dark:text-gray-300">admin</span> / Admin@123 · 9876543210</div>
                <div><span className="font-medium text-gray-700 dark:text-gray-300">supervisor</span> / Super@123 · 9876543211</div>
                <div><span className="font-medium text-gray-700 dark:text-gray-300">operator</span> / Oper@123 · 9876543212</div>
                <div>Mobile OTP: <span className="font-medium text-gray-700 dark:text-gray-300">123456</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-gray-900">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-900 to-gray-950" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.15]" aria-hidden="true">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 text-white">
          <div className="text-xs uppercase tracking-[0.2em] text-brand-200 font-semibold mb-4">Spinning Unit 1 · Coimbatore</div>
          <h2 className="text-3xl lg:text-4xl font-bold leading-tight mb-4">Every machine. Every shift.<br />One live view.</h2>
          <p className="text-brand-100/80 mb-10 max-w-md">Connected carding, draw frame, simplex, ring frame and autoconer lines reporting in real time.</p>
          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <div className="w-10 h-10 shrink-0 rounded-lg bg-white/10 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-brand-100/70">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
