/**
 * Shared helpers for the server URL used by both the login flow and the
 * WebSocket connection inside the overlay. Defaults come from `.env`
 * (`VITE_SERVER_BASE_URL`); nothing is persisted to localStorage.
 */

const FALLBACK_HTTP_BASE_URL = 'http://localhost:5000'

const LEGACY_STORAGE_KEYS = [
  'vitt-overlay-ws-url',
  'vitt-overlay-auth-user',
  'vitt-overlay-access-token'
] as const

function httpBaseToWsUrl(httpBase: string): string {
  try {
    const u = new URL(httpBase)
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:'
    const path = u.pathname && u.pathname !== '/' ? u.pathname : '/ws'
    return `${proto}//${u.host}${path}`
  } catch {
    return 'ws://localhost:5000/ws'
  }
}

export const DEFAULT_HTTP_BASE_URL =
  (import.meta.env.VITE_SERVER_BASE_URL?.trim()) || FALLBACK_HTTP_BASE_URL

export const DEFAULT_WS_URL = httpBaseToWsUrl(DEFAULT_HTTP_BASE_URL)

/** Remove legacy localStorage keys from older builds. */
export function clearLegacyStoredPreferences(): void {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch {
    /* private mode or blocked storage */
  }
}

/**
 * Coerce arbitrary user input into a valid ws:// or wss:// URL with a
 * sensible default path of /ws.
 */
export function normalizeWebSocketUrl(input: string): string {
  let s = input.trim()
  if (!s) return DEFAULT_WS_URL

  if (/^https:\/\//i.test(s)) {
    s = `wss://${s.slice(8)}`
  } else if (/^http:\/\//i.test(s)) {
    s = `ws://${s.slice(7)}`
  } else if (!/^wss?:\/\//i.test(s)) {
    s = `wss://${s.replace(/^\/+/, '')}`
  }

  try {
    const u = new URL(s)
    if (!u.pathname || u.pathname === '/') {
      u.pathname = '/ws'
    }
    return u.toString()
  } catch {
    return /^wss?:\/\//i.test(s) ? s : DEFAULT_WS_URL
  }
}

/**
 * Convert a ws/wss URL into the matching http/https origin so it can be
 * used for REST calls against the same server (login, etc.).
 */
export function wsUrlToHttpOrigin(wsUrl: string): string {
  try {
    const u = new URL(wsUrl)
    const scheme = u.protocol === 'wss:' ? 'https:' : 'http:'
    return `${scheme}//${u.host}`
  } catch {
    return ''
  }
}
