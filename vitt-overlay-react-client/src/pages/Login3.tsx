import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import {
  ArrowRight,
  Minus,
  Server,
  Sparkles,
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useServerUrl } from '../context/ServerUrlContext'
import WindowResizeButton from '../components/WindowResizeButton'
import {
  normalizeWebSocketUrl,
  wsUrlToHttpOrigin
} from '../functions/serverUrl'
import '../App.css'

type LoginResponse = {
  success: boolean
  message: string
  clientId?: string
  name?: string
  email?: string
  meetingId?: string
  source?:string
}

type ConnState = 'idle' | 'connecting' | 'connected' | 'failed'

const CONNECTION_PROBE_TIMEOUT_MS = 5000

export default function Login3() {
  const navigate = useNavigate()
  const { setCurrentUser, setaccess_token } = useAuth()
  const { wsUrlDraft, updateWsUrlDraft, commitWsUrlDraft } = useServerUrl()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transparency] = useState(85)

  const [connState, setConnState] = useState<ConnState>('idle')
  const [activeProbeUrl, setActiveProbeUrl] = useState<string>('')
  const probeRef = useRef<WebSocket | null>(null)
  const probeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const normalizedUrl = useMemo(() => normalizeWebSocketUrl(wsUrlDraft), [wsUrlDraft])

  const closeProbe = () => {
    if (probeTimeoutRef.current) {
      clearTimeout(probeTimeoutRef.current)
      probeTimeoutRef.current = null
    }
    const ws = probeRef.current
    if (ws) {
      ws.onopen = null
      ws.onclose = null
      ws.onerror = null
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      probeRef.current = null
    }
  }

  const probeConnection = (urlToProbe: string) => {
    closeProbe()
    setActiveProbeUrl(urlToProbe)
    setConnState('connecting')

    let settled = false

    try {
      const ws = new WebSocket(urlToProbe)
      probeRef.current = ws

      probeTimeoutRef.current = setTimeout(() => {
        if (settled) return
        settled = true
        setConnState('failed')
        closeProbe()
      }, CONNECTION_PROBE_TIMEOUT_MS)

      ws.onopen = () => {
        if (settled) return
        settled = true
        setConnState('connected')
        if (probeTimeoutRef.current) {
          clearTimeout(probeTimeoutRef.current)
          probeTimeoutRef.current = null
        }
        try {
          ws.close()
        } catch {
          /* ignore */
        }
        probeRef.current = null
      }

      ws.onerror = () => {
        if (settled) return
        settled = true
        setConnState('failed')
        closeProbe()
      }

      ws.onclose = () => {
        if (settled) return
        settled = true
        setConnState('failed')
        closeProbe()
      }
    } catch {
      setConnState('failed')
    }
  }

  useEffect(() => {
    probeConnection(normalizedUrl)
    return () => {
      closeProbe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedUrl])

  const handleSaveServerUrl = () => {
    commitWsUrlDraft()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Please enter both email and password.')
      return
    }

    setError('')
    setIsSubmitting(true)

    commitWsUrlDraft()
    const finalWsUrl = normalizeWebSocketUrl(wsUrlDraft)

    const origin = wsUrlToHttpOrigin(finalWsUrl)
    if (!origin) {
      setError('Invalid server URL. Please check the value above.')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch(`${origin}/login-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      })

      const data = (await response.json()) as LoginResponse

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Login failed')
      }

      const sessionuid = uuidv4()

      const normalizedUser = {
        userid: data.clientId || email.trim(),
        id: data.clientId || email.trim(),
        sessionuid,
        name: data.name || email.trim().split('@')[0],
        email: data.email || email.trim(),
        role: 'User',
        clientId: data.clientId || '',
        meetingId: data.meetingId || '',
        source:data?.source || '',
      }

      setCurrentUser(normalizedUser)
      setaccess_token(`session-${data.clientId || 'active'}`)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete login')
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeApp = () => {
    const overlay = (window as unknown as { overlay?: { quitApp?: () => void } }).overlay
    if (overlay?.quitApp) {
      overlay.quitApp()
      return
    }
    const electronAPI = (window as unknown as {
      electronAPI?: { ipcRenderer: { send: (c: string, p: unknown) => void } }
    }).electronAPI
    electronAPI?.ipcRenderer?.send('close-app', undefined)
  }

  const minimizeApp = () => {
    const overlay = (window as unknown as { overlay?: { minimizeApp?: () => void } }).overlay
    if (overlay?.minimizeApp) {
      overlay.minimizeApp()
      return
    }
    const electronAPI = (window as unknown as {
      electronAPI?: { ipcRenderer: { send: (c: string, p: unknown) => void } }
    }).electronAPI
    electronAPI?.ipcRenderer?.send('minimize-app', undefined)
  }

  const connStateLabel: Record<ConnState, string> = {
    idle: 'Idle',
    connecting: 'Connecting…',
    connected: 'Server Connected',
    failed: 'Server Unreachable'
  }
  const connStateColor: Record<ConnState, string> = {
    idle: 'var(--text-muted)',
    connecting: 'var(--text-muted)',
    connected: '#22c55e',
    failed: '#ef4444'
  }

  return (
    <div className="drag-region">
      <div
        className="card app4-card drag-region"
        id="card"
        data-theme="transparent"
        style={{ ['--bg-opacity' as string]: transparency / 100 }}
      >
        <div className="app4-header drag-region">
          <div className="app4-title">
            <span className="dot" />
            <span>Vitt Overlay</span>
          </div>
          <div className="app4-actions no-drag">
            <button type="button" className="btn-icon" onClick={minimizeApp} title="Minimize">
              <Minus size={18} />
            </button>
            <WindowResizeButton />
            <button type="button" className="btn-icon danger" onClick={closeApp} title="Quit">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="login3-shell no-drag">
          <div className="login3-hero">
            <div className="login3-chip">
              <Sparkles size={12} />
              <span>Sign in to continue</span>
            </div>
            <h2 className="login3-title">Welcome back</h2>
            <p className="login3-subtitle">
              Connect to your Vitt server and sign in to access the live overlay.
            </p>
          </div>

          <div className="setting-section login3-section">
            <div className="setting-header">Server</div>
            <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <span className="setting-label">WebSocket URL</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  className="setting-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={wsUrlDraft}
                  onChange={(e) => updateWsUrlDraft(e.target.value)}
                  onBlur={handleSaveServerUrl}
                  placeholder="https://….ngrok-free.app or wss://host/ws"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
              <div className="login3-status-row">
                <span
                  className="login3-status-dot"
                  style={{ background: connStateColor[connState] }}
                />
                <span className="login3-status-text" style={{ color: connStateColor[connState] }}>
                  {connStateLabel[connState]}
                </span>
                <button
                  type="button"
                  className="login3-retry"
                  onClick={() => probeConnection(normalizeWebSocketUrl(wsUrlDraft))}
                  disabled={connState === 'connecting'}
                  title="Test connection again"
                >
                  Test
                </button>
              </div>
              {activeProbeUrl ? (
                <span className="login3-helper-text" title={activeProbeUrl}>
                  Target: <code>{activeProbeUrl}</code>
                </span>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login3-form">
            <label className="login3-float-field">
              <input
                type="email"
                className="login3-float-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                autoComplete="username"
                required
              />
              <span className="login3-float-label">Email Address</span>
            </label>

            <label className="login3-float-field">
              <input
                type="password"
                className="login3-float-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                autoComplete="current-password"
                required
              />
              <span className="login3-float-label">Password</span>
            </label>

            {error ? <div className="login3-error">{error}</div> : null}

            <button
              type="submit"
              className="btn-primary login3-submit"
              disabled={isSubmitting}
            >
              <span>{isSubmitting ? 'Signing in…' : 'Sign in'}</span>
              {!isSubmitting ? <ArrowRight size={16} /> : null}
            </button>
          </form>
        </div>

        <div className="bottom-hint no-drag">
          Toggle overlay with Alt + Shift + H
        </div>
      </div>
    </div>
  )
}
