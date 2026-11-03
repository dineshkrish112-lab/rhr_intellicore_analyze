const TOKEN_KEY = 'rhr_token'

let onUnauthorized = () => {}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: session lasts for this tab only */
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * The backend always answers errors with a JSON body. A 5xx without one comes from the dev
 * proxy, which means the backend itself is not running or not reachable.
 */
async function errorMessage(res) {
  try {
    const body = await res.json()
    if (body?.message) return body.message
  } catch {
    /* non-JSON error body */
  }
  if (res.status >= 500) return 'Cannot reach the backend server (port 8085). Start the Spring Boot app and try again.'
  return res.statusText
}

export async function api(path, { method = 'GET', body, params } = {}) {
  const url = new URL('/api' + path, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    })
  }
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  if (res.status === 401 && !path.startsWith('/auth/')) {
    onUnauthorized()
    throw new ApiError(401, 'Session expired, please sign in again')
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  if (res.status === 204) return null
  const type = res.headers.get('content-type') || ''
  return type.includes('application/json') ? res.json() : res.text()
}

/** Downloads a server-generated file using the bearer token, then triggers a save. */
export async function download(path, params, fallbackName) {
  const url = new URL('/api' + path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (res.status === 401) {
    onUnauthorized()
    throw new ApiError(401, 'Session expired')
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  const blob = await res.blob()
  const cd = res.headers.get('content-disposition') || ''
  const match = cd.match(/filename="?([^";]+)"?/)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = match ? match[1] : fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
