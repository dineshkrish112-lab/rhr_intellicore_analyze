import { NavLink } from 'react-router-dom'
import { LogOut, X, Factory, Radio } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLive } from '../context/LiveContext.jsx'
import { NAV_GROUPS } from './nav.js'

export function Logo({ dark = false, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/30">
        <Factory className="w-5 h-5 text-white" strokeWidth={2.2} />
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-ink-900" />
      </div>
      <div className="leading-tight">
        <div className={`font-extrabold tracking-tight ${dark ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Intellicore</div>
        <div className={`text-[10px] uppercase tracking-[0.18em] font-bold ${dark ? 'text-brand-300' : 'text-brand-600 dark:text-brand-300'}`}>RHR · Industrial IoT</div>
      </div>
    </div>
  )
}

export default function Sidebar({ open, setOpen }) {
  const { logout, user } = useAuth()
  const { activeAlarms, connected, machines } = useLive()
  const online = machines.filter((m) => m.online).length

  return (
    <>
      <div
        className={`fixed inset-0 bg-ink-950/60 z-40 lg:hidden transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`flex flex-col fixed z-40 left-0 top-0 lg:static lg:translate-x-0 h-[100dvh] overflow-y-auto no-scrollbar w-72 shrink-0 bg-ink-900 text-gray-300 transition-transform duration-200 ease-in-out ${open ? 'translate-x-0' : '-translate-x-72'}`}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-8">
          <Logo dark />
          <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Close sidebar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-3 space-y-6">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">{g.label}</h3>
              <ul className="space-y-1">
                {g.items.map(({ to, label, hint, icon: Icon, end, badge }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                          isActive ? 'bg-white/[0.07] text-white' : 'hover:bg-white/[0.04] hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-400" />}
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${isActive ? 'bg-brand-500/20 text-brand-300' : 'bg-white/[0.04] text-gray-400 group-hover:text-gray-200'}`}>
                            <Icon className="w-[18px] h-[18px]" />
                          </span>
                          <span className="min-w-0 grow">
                            <span className="block text-sm font-semibold">{label}</span>
                            <span className="block text-[11px] text-gray-500 truncate">{hint}</span>
                          </span>
                          {badge === 'alarms' && activeAlarms > 0 && (
                            <span className="num text-[11px] font-bold text-white px-1.5 py-0.5 rounded-md bg-red-500">{activeAlarms}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-auto p-4 space-y-3">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5">
            <div className="flex items-center justify-between">
              <span className="eyebrow !text-gray-500">Data link</span>
              <span className={`chip ${connected ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
                {connected ? 'Streaming' : 'Polling'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-300">
              <Radio className="w-4 h-4 text-brand-300" />
              <span className="num font-semibold text-white">{online}</span>/<span className="num">{machines.length}</span> machines reporting
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:bg-red-500/10 hover:text-red-300 transition"
          >
            <span className="truncate">Sign out {user?.username}</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  )
}
