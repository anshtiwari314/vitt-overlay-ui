import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_WS_URL, normalizeWebSocketUrl } from '../functions/serverUrl'

type ServerUrlContextValue = {
  /** Normalized URL used for WebSocket connections. */
  wsUrl: string
  /** Raw input shown on login and settings (kept in sync across routes). */
  wsUrlDraft: string
  updateWsUrlDraft: (rawInput: string) => void
  commitWsUrlDraft: () => void
  setWsUrlFromInput: (rawInput: string) => void
}

const ServerUrlContext = createContext<ServerUrlContextValue | null>(null)

export function useServerUrl() {
  const context = useContext(ServerUrlContext)
  if (!context) {
    throw new Error('useServerUrl must be used within ServerUrlProvider')
  }
  return context
}

export function ServerUrlProvider({ children }: { children: React.ReactNode }) {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL)
  const [wsUrlDraft, setWsUrlDraft] = useState(DEFAULT_WS_URL)

  const setWsUrlFromInput = useCallback((rawInput: string) => {
    const normalized = normalizeWebSocketUrl(rawInput)
    setWsUrl(normalized)
    setWsUrlDraft(normalized)
  }, [])

  const updateWsUrlDraft = useCallback((rawInput: string) => {
    setWsUrlDraft(rawInput)
  }, [])

  const commitWsUrlDraft = useCallback(() => {
    const normalized = normalizeWebSocketUrl(wsUrlDraft)
    setWsUrl(normalized)
    setWsUrlDraft(normalized)
  }, [wsUrlDraft])

  const value = useMemo(
    () => ({
      wsUrl,
      wsUrlDraft,
      updateWsUrlDraft,
      commitWsUrlDraft,
      setWsUrlFromInput
    }),
    [wsUrl, wsUrlDraft, updateWsUrlDraft, commitWsUrlDraft, setWsUrlFromInput]
  )

  return <ServerUrlContext.Provider value={value}>{children}</ServerUrlContext.Provider>
}
