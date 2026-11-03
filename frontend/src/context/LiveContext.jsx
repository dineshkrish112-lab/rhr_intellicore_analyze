import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api, getToken } from '../lib/api.js'
import { parseLocal } from '../lib/format.js'

const LiveContext = createContext(null)

/**
 * One shared Server-Sent Events connection for the signed-in session. Falls back to
 * polling while the stream is down, and tracks the offset to the plant's clock.
 */
export function LiveProvider({ children }) {
  const [machines, setMachines] = useState([])
  const [shift, setShift] = useState(null)
  const [activeAlarms, setActiveAlarms] = useState(0)
  const [connected, setConnected] = useState(false)
  const [offsetMs, setOffsetMs] = useState(0)
  const pollRef = useRef(null)

  useEffect(() => {
    let es
    let closed = false

    const apply = (data) => {
      setMachines(data.machines)
      setShift(data.shift)
      setActiveAlarms(data.activeAlarms)
      const server = parseLocal(data.shift.serverTime)
      if (server) setOffsetMs(server.getTime() - Date.now())
    }

    const poll = async () => {
      try {
        const [m, s, a] = await Promise.all([
          api('/live'),
          api('/shifts/current'),
          api('/alarms', { params: { size: 1 } }),
        ])
        apply({ machines: m, shift: s, activeAlarms: a.activeCount })
      } catch {
        /* keep last known values */
      }
    }

    const startPolling = () => {
      if (!pollRef.current) pollRef.current = setInterval(poll, 5000)
    }
    const stopPolling = () => {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    const connect = () => {
      if (closed) return
      es = new EventSource(`/api/live/stream?access_token=${encodeURIComponent(getToken() || '')}`)
      es.addEventListener('live', (e) => {
        setConnected(true)
        stopPolling()
        apply(JSON.parse(e.data))
      })
      es.onerror = () => {
        setConnected(false)
        es.close()
        startPolling()
        setTimeout(connect, 5000)
      }
    }

    poll()
    connect()
    return () => {
      closed = true
      es?.close()
      stopPolling()
    }
  }, [])

  return (
    <LiveContext.Provider value={{ machines, shift, activeAlarms, connected, offsetMs, setActiveAlarms }}>
      {children}
    </LiveContext.Provider>
  )
}

export const useLive = () => useContext(LiveContext)

/** Ticks once a second and returns the plant clock in ms. */
export function usePlantClock() {
  const { offsetMs } = useLive()
  const [now, setNow] = useState(() => Date.now() + offsetMs)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offsetMs), 1000)
    setNow(Date.now() + offsetMs)
    return () => clearInterval(id)
  }, [offsetMs])
  return now
}
