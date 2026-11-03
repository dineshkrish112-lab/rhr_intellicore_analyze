import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api.js'

const AuthContext = createContext(null)
const USER_KEY = 'rhr_user'

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw && getToken() ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser)
  const navigate = useNavigate()

  const store = useCallback((u) => {
    setUser(u)
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
      else localStorage.removeItem(USER_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const logout = useCallback(() => {
    api('/auth/logout', { method: 'POST' }).catch(() => {})
    setToken(null)
    store(null)
    navigate('/login', { replace: true })
  }, [navigate, store])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      store(null)
      navigate('/login', { replace: true })
    })
  }, [navigate, store])

  // Refresh the cached profile once per load so role / name changes show up.
  useEffect(() => {
    if (getToken()) api('/auth/me').then(store).catch(() => {})
  }, [store])

  const complete = useCallback(
    (res) => {
      setToken(res.token)
      store(res.user)
      navigate('/', { replace: true })
    },
    [navigate, store],
  )

  const loginWithPassword = (username, password) =>
    api('/auth/login', { method: 'POST', body: { username, password } }).then(complete)

  const requestOtp = (mobile) => api('/auth/otp/request', { method: 'POST', body: { mobile } })

  const verifyOtp = (mobile, otp) =>
    api('/auth/otp/verify', { method: 'POST', body: { mobile, otp } }).then(complete)

  return (
    <AuthContext.Provider value={{ user, setUser: store, loginWithPassword, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
