import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Moon, Sun, Bell, ChevronDown, LogOut, UserCircle2, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useLive, usePlantClock } from '../context/LiveContext.jsx'
import { useChartTheme } from '../charts/chartTheme.js'
import { fmtDuration, initials, parseLocal } from '../lib/format.js'
import { findNav } from './nav.js'

/** Always-visible plant context: clock, production day and how far through the shift we are. */
function ShiftStrip() {
  const now = usePlantClock()
  const { shift } = useLive()
  const t = useChartTheme()
  if (!shift) return null
  const cur = shift.shift
  const start = parseLocal(cur.start).getTime()
  const end = parseLocal(cur.end).getTime()
  const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  const color = t.shift(cur.code)
  return (
    <div className="hidden md:flex items-center gap-4 pl-4 pr-3 py-1.5 rounded-xl bg-brand-50/70 dark:bg-gray-900 border border-brand-100 dark:border-gray-800">
      <div className="num text-lg font-semibold text-gray-900 dark:text-gray-50">{new Date(now).toLocaleTimeString('en-IN', { hour12: false })}</div>
      <div className="w-px h-7 bg-gray-200 dark:bg-gray-700" />
      <div className="w-48">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5 whitespace-nowrap" title={cur.name}>
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            Shift {cur.code}
          </span>
          <span className="num text-gray-500">{fmtDuration((end - now) / 1000)} left</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, background: color }} />
        </div>
      </div>
      <div className="hidden xl:block text-xs leading-tight">
        <div className="eyebrow">Production day</div>
        <div className="num font-semibold text-gray-800 dark:text-gray-200">{cur.shiftDate}</div>
      </div>
    </div>
  )
}

export default function Header({ onMenu, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const { activeAlarms } = useLive()
  const { pathname } = useLocation()
  const nav = findNav(pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-white/75 dark:bg-gray-950/85 backdrop-blur-md border-b border-[#e1eaf6] dark:border-gray-800">
      <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 h-16">
        <div className="flex items-center gap-3 min-w-0">
          <button className="lg:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={onMenu} aria-label="Open navigation">
            <Menu className="w-6 h-6" />
          </button>
          <button
            className="hidden lg:flex w-9 h-9 items-center justify-center rounded-xl text-gray-500 hover:bg-white hover:text-gray-800 dark:hover:bg-gray-900 dark:hover:text-gray-200"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          {nav && (
            <div className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-gray-400">{nav.group}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
              <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">{nav.item.label}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ShiftStrip />
          <Link
            to="/alarms"
            className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-gray-900 text-gray-500 dark:text-gray-400"
            aria-label={`${activeAlarms} active alarms`}
          >
            <Bell className="w-5 h-5" />
            {activeAlarms > 0 && (
              <span className="num absolute top-1 right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-950">
                {activeAlarms > 99 ? '99+' : activeAlarms}
              </span>
            )}
          </Link>
          <button
            onClick={toggle}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-gray-900 text-gray-500 dark:text-gray-400"
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={dark ? 'Light theme' : 'Dark theme'}
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-white dark:hover:bg-gray-900" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="true" aria-expanded={menuOpen}>
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white text-xs font-bold flex items-center justify-center">{initials(user?.fullName)}</span>
              <span className="hidden lg:block text-left leading-tight">
                <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{user?.fullName}</span>
                <span className="block text-[11px] text-gray-400">{user?.role?.toLowerCase()}</span>
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 card p-1.5">
                <div className="px-3 py-2 mb-1 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user?.username}</div>
                  <div className="text-xs text-gray-500">{user?.designation}</div>
                </div>
                <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <UserCircle2 className="w-4 h-4" /> Profile & plant
                </Link>
                <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
