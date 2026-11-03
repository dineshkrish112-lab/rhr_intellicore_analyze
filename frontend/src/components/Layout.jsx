import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const scrollRef = useRef(null)
  const { pathname } = useLocation()

  // The content pane scrolls, not the window, so reset it ourselves on navigation.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div ref={scrollRef} className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header onMenu={() => setSidebarOpen(true)} />
        <main className="grow">
          <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 w-full max-w-[96rem] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
