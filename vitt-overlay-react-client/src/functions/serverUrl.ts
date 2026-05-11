/**
 * Shared helpers for the server URL used by both the login flow and the
 * WebSocket connection inside the overlay. A single source of truth ensures
 * whatever URL the user enters at login is the same one App.tsx connects to
 * after authentication.
 */

export const WS_URL_STORAGE_KEY = 'vitt-overlay-ws-url'
export const DEFAULT_WS_URL = 'wss://localhost:5173/ws'

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

export function readStoredWsUrl(): string {
  try {
    const raw = localStorage.getItem(WS_URL_STORAGE_KEY)
    if (raw?.trim()) return normalizeWebSocketUrl(raw)
  } catch {
    /* private mode or blocked storage */
  }
  return DEFAULT_WS_URL
}

export function persistWsUrl(url: string): void {
  try {
    localStorage.setItem(WS_URL_STORAGE_KEY, url)
  } catch {
    /* ignore */
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
