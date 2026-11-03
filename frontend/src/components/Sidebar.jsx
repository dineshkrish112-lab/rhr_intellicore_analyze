import { NavLink } from 'react-router-dom'
import { LogOut, X, Factory, Radio, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLive } from '../context/LiveContext.jsx'
import { NAV_GROUPS } from './nav.js'

export function Logo({ railOnDesktop = false, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-sky-400 to-brand-600 flex items-center justify-center shadow-md shadow-brand-600/30">
        <Factory className="w-5 h-5 text-white" strokeWidth={2.2} />
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-ink-900" />
      </div>
      <div className={`leading-tight ${railOnDesktop ? 'lg:hidden' : ''}`}>
        <div className="font-extrabold tracking-tight text-gray-900 dark:text-white">Intellicore</div>
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-brand-600 dark:text-brand-300">RHR · Industrial IoT</div>
      </div>
    </div>
  )
}

/**
 * White panel in the light theme, ink panel in the dark theme. On desktop it can collapse to an
 * icon rail; on mobile it slides in over the page.
 */
export default function Sidebar({ open, setOpen, collapsed, onToggleCollapse }) {
  const { logout, user } = useAuth()
  const { activeAlarms, connected, machines } = useLive()
  const online = machines.filter((m) => m.online).length
  // Collapsing only affects desktop (lg:); the mobile drawer always shows full labels.
  const rail = collapsed

  return (
    <>
      <div
        className={`fixed inset-0 bg-ink-950/40 z-40 lg:hidden transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`group/side flex flex-col fixed z-40 left-0 top-0 lg:static lg:translate-x-0 h-[100dvh] overflow-y-auto overflow-x-hidden no-scrollbar shrink-0
          bg-white dark:bg-ink-900 border-r border-[#e1eaf6] dark:border-gray-800 text-gray-600 dark:text-gray-300
          transition-[width,transform] duration-200 ease-in-out w-72 ${rail ? 'lg:w-20' : 'lg:w-72'} ${open ? 'translate-x-0' : '-translate-x-72'}`}
        aria-label="Main navigation"
      >
        <div className={`flex items-center justify-between pt-6 pb-8 ${rail ? 'px-5 lg:px-0 lg:justify-center' : 'px-5'}`}>
          <Logo railOnDesktop={rail} />
          <button className="lg:hidden text-gray-400 hover:text-gray-700 dark:hover:text-white" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className={`space-y-6 ${rail ? 'px-3 lg:px-2' : 'px-3'}`}>
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              {rail ? (
                <div className="hidden lg:block mx-auto mb-2 w-6 h-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
              ) : null}
              <h3 className={`px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500 ${rail ? 'lg:hidden' : ''}`}>{g.label}</h3>
              <ul className="space-y-1">
                {g.items.map(({ to, label, hint, icon: Icon, end, badge }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={() => setOpen(false)}
                      title={rail ? `${label} — ${hint}` : undefined}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-xl transition ${rail ? 'px-3 py-2.5 lg:justify-center lg:px-0' : 'px-3 py-2.5'} ${
                          isActive
                            ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-600/25 dark:from-brand-600 dark:to-brand-700'
                            : 'hover:bg-brand-50 hover:text-brand-800 dark:hover:bg-white/[0.04] dark:hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-brand-50 text-brand-600 group-hover:bg-white dark:bg-white/[0.04] dark:text-gray-400 dark:group-hover:text-gray-200'
                            }`}
                          >
                            <Icon className="w-[18px] h-[18px]" />
                            {rail && badge === 'alarms' && activeAlarms > 0 && (
                              <span className="hidden lg:block absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-ink-900" />
                            )}
                          </span>
                          <span className={`min-w-0 grow ${rail ? 'lg:hidden' : ''}`}>
                            <span className="block text-sm font-semibold">{label}</span>
                            <span className={`block text-[11px] truncate ${isActive ? 'text-white/75' : 'text-gray-400 dark:text-gray-500'}`}>{hint}</span>
                          </span>
                          {badge === 'alarms' && activeAlarms > 0 && (
                            <span className={`num text-[11px] font-bold text-white px-1.5 py-0.5 rounded-md bg-red-500 ring-2 ring-white/40 ${rail ? 'lg:hidden' : ''}`}>{activeAlarms}</span>
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

        <div className={`mt-auto space-y-2 ${rail ? 'p-4 lg:px-2' : 'p-4'}`}>
          <div className={`rounded-2xl bg-gradient-to-br from-brand-50 to-sky-50 border border-brand-100 dark:from-white/[0.04] dark:to-white/[0.02] dark:border-white/[0.06] p-3.5 ${rail ? 'lg:hidden' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="eyebrow">Data link</span>
              <span className={`chip ${connected ? 'bg-green-500/15 text-green-700 dark:text-green-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                {connected ? 'Streaming' : 'Polling'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <Radio className="w-4 h-4 text-brand-600 dark:text-brand-300" />
              <span className="num font-semibold text-gray-900 dark:text-white">{online}</span>/<span className="num">{machines.length}</span> machines reporting
            </div>
          </div>
          {rail && (
            <div className="hidden lg:flex justify-center py-1" title={connected ? 'Live stream connected' : 'Reconnecting (polling)'}>
              <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
            </div>
          )}
          <button
            onClick={logout}
            title={rail ? 'Sign out' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300 transition ${rail ? 'justify-between lg:justify-center' : 'justify-between'}`}
          >
            <span className={`truncate ${rail ? 'lg:hidden' : ''}`}>Sign out {user?.username}</span>
            <LogOut className="w-4 h-4 shrink-0" />
          </button>
          <button
            onClick={onToggleCollapse}
            className={`hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/[0.04] dark:hover:text-white transition ${rail ? 'justify-center' : 'justify-between'}`}
            aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
            title={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {!rail && <span>Collapse</span>}
            {rail ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  )
}
