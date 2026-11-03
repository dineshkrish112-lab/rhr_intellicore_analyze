import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'

const COLLAPSE_KEY = 'rhr_sidebar_collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export default function Layout() {
  // Mobile: off-canvas drawer. Desktop: full width or a collapsed icon rail.
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const scrollRef = useRef(null)
  const { pathname } = useLocation()

  // The content pane scrolls, not the window, so reset it ourselves on navigation.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* preference just won't persist */
    }
  }, [collapsed])

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar open={mobileOpen} setOpen={setMobileOpen} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <div ref={scrollRef} className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header onMenu={() => setMobileOpen(true)} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
        <main className="grow">
          <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 w-full max-w-[96rem] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
