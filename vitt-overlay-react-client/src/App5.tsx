import React, { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import './App.css'
import './App5.css'
import { addTranscription } from './redux/reducers/TranscriptionReducer'
import { addPrompt } from './redux/reducers/promptsReducer'
import { addOutgoingMessage, addIncomingMessages } from './redux/reducers/chatWithAIReducer'
import parse from 'html-react-parser'
import ReactHtmlParser from 'html-react-parser'
import {
  SunMoon,
  SunMedium,
  Minus,
  LayoutDashboard,
  X,
  Loader2
} from 'lucide-react'
import { useData } from './context/DataWrapper'
import { useAuth } from './context/AuthContext'
import { getTimeStamp } from './functions/generalFn'
import type { ChatMessage } from './redux/reducers/chatWithAIReducer'

/** Single shared WebSocket for the app so only one connection exists. */
let app5SharedWs: WebSocket | null = null

// --- Components ---

// Tabs are intentionally hidden from the UI; AI Chat remains default.

const CHAT_RESPONSE_TIMEOUT_MS = 15000

function ChatWithAITab({
  userid,
  sessionid
}: {
  setCopyToast?: (v: boolean) => void
  userid: string
  sessionid: string
}) {
  const dispatch = useDispatch()
  const { wsRef } = (useData() as unknown) as { wsRef: React.MutableRefObject<WebSocket | null> }
  const messages = useSelector((state: { chatWithAIReducer: { messages: ChatMessage[] } }) => state.chatWithAIReducer.messages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const onResponse = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setSending(false)
    }
    window.addEventListener('chat-response-received', onResponse)
    return () => window.removeEventListener('chat-response-received', onResponse)
  }, [])

  const sendMessage = () => {
    const query = input.trim()
    if (!query || sending) return
    const timestamp = getTimeStamp()
    dispatch(addOutgoingMessage({ content: query, timestamp }))
    setInput('')
    setSending(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      setSending(false)
    }, CHAT_RESPONSE_TIMEOUT_MS)
    const ws = (wsRef as React.MutableRefObject<WebSocket | null>).current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'chat-with-ai',
          userid,
          sessionid,
          query,
          timestamp
        })
      )
    } else {
      dispatch(
        addIncomingMessages({
          content: ['Not connected. Please check your connection.'],
          res_timestamp: getTimeStamp()
        })
      )
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-tab">
      <div className="chat-messages">
        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="chat-message-out">
              {msg.content}
            </div>
          ) : (
            <div key={msg.id} className="chat-message-in">
              <div className="chat-html-content">{ReactHtmlParser(msg.content)}</div>
              
            </div>
          )
        )}
        {sending && (
          <div className="chat-loading">
            <Loader2 size={20} className="chat-loading-spinner" />
            <span>Waiting for response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-wrap">
        <div className="chat-textarea-wrap">
          <textarea
            className="chat-textarea"
            placeholder="Type a message... (Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}

// --- Main App Component ---

export default function App5() {
  const recallElectronAPI = (window as unknown as { electronAPI?: { ipcRenderer: { on: (c: string, h: (s: unknown) => void) => void; send: (c: string, p: unknown) => void; removeAllListeners: (c: string) => void } } }).electronAPI?.ipcRenderer
  const wsUrl = 'ws://34.100.145.102/ws'
  //const wsUrl = 'ws://192.168.1.35:8080/';
  //const wsUrl = 'wss://abdb2e4353fb.ngrok-free.app/ws'
  const [selectedTab, setSelectedTab] = useState('chat')
  const [theme, setTheme] = useState('transparent')
  const [copyToast, setCopyToast] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const [isServerConnected, setIsServerConnected] = useState(false)
  const [sdkState, setSdkState] = useState({
    recording: false,
    permissions_granted: true,
    meetings: [] as { id: string; title: string; status: string; uploadPercentage?: number }[]
  })

  const { currentUser } = (useAuth() as unknown) as { currentUser: { userid?: string; id?: string; sessionuid?: string } | null }
  const { wsRef } = (useData() as unknown) as { wsRef: React.MutableRefObject<WebSocket | null> }
  const currentUserRef = useRef(currentUser)
  const sessionuidRef = useRef((currentUser as { sessionuid?: string })?.sessionuid)

  useEffect(() => {
    // Debug info to compare dev vs packaged builds
    // eslint-disable-next-line no-console
    console.log(
      'App5 init - bridge debug',
      JSON.stringify({
        overlayExists: !!(window as unknown as { overlay?: unknown }).overlay,
        electronAPIExists: !!recallElectronAPI
      })
    )
  }, [recallElectronAPI])

  useEffect(() => {
    currentUserRef.current = currentUser
    sessionuidRef.current = (currentUser as { sessionuid?: string })?.sessionuid
  }, [currentUser])

  useEffect(() => {
    const formatNow = () =>
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setCurrentTime(formatNow())
    const timer = setInterval(() => {
      setCurrentTime(formatNow())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!recallElectronAPI) return
    recallElectronAPI.on('state', (newState: unknown) => setSdkState(newState as typeof sdkState))
    recallElectronAPI.send('message-from-renderer', { command: 'renderer-ready' })
    return () => recallElectronAPI.removeAllListeners('state')
  }, [])

  const dispatch = useDispatch()
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
  useEffect(() => {
    const ref = wsRef as React.MutableRefObject<WebSocket | null>
    if (app5SharedWs && (app5SharedWs.readyState === WebSocket.OPEN || app5SharedWs.readyState === WebSocket.CONNECTING)) {
      ref.current = app5SharedWs
      return () => {
        ref.current = null
      }
    }
    if (ref.current != null) return () => { ref.current = null }
    let tempWs: WebSocket
    const reconnectInterval = 1000
    function connect() {
      if (app5SharedWs && (app5SharedWs.readyState === WebSocket.OPEN || app5SharedWs.readyState === WebSocket.CONNECTING)) {
        ref.current = app5SharedWs
        return
      }
      tempWs = new WebSocket(wsUrl)
      app5SharedWs = tempWs
      ref.current = tempWs
      tempWs.onopen = () => {
        setIsServerConnected(true)
        tempWs.send('Hello from browser!')
      }
      tempWs.onmessage = (event: MessageEvent) => {
        try {
          const result = JSON.parse(event.data as string) as Record<string, unknown>
          const d = dispatchRef.current
          if (result.type === 'transcript') {
            const text = (result.text ?? result.transcription) as string | undefined
            const speaker = result.speaker as string | undefined
            d(addTranscription({ ...result, text: text ?? '', speaker }))
          }
          if (result.type === 'llm_response') {
            const text = ((result.text ?? result.prompt ?? result.response) as string) ?? ''
            d(addPrompt({ text }))
          }
          if (result.type === 'chat-with-ai-response') {
            const content = (Array.isArray(result.content) ? result.content : []) as string[]
            const res_timestamp = result?.res_timestamp as string | undefined
            d(addIncomingMessages({ content, res_timestamp }))
            window.dispatchEvent(new CustomEvent('chat-response-received'))
          }
        } catch {
          /* ignore non-json */
        }
      }
      tempWs.onclose = () => {
        setIsServerConnected(false)
        app5SharedWs = null
        ref.current = null
        setTimeout(connect, reconnectInterval)
      }
      tempWs.onerror = () => {
        setIsServerConnected(false)
      }
    }
    connect()
    return () => {
      ref.current = null
    }
  }, [])

  const closeApp = () => {
    // eslint-disable-next-line no-console
    console.log(
      'closeApp clicked',
      JSON.stringify({
        overlayExists: !!(window as unknown as { overlay?: unknown }).overlay,
        electronAPIExists: !!recallElectronAPI
      })
    )
    const overlay = (window as unknown as { overlay?: { quitApp?: () => void } }).overlay
    if (overlay?.quitApp) {
      overlay.quitApp()
      return
    }
    recallElectronAPI?.send('close-app', undefined)
  }

  const minimizeApp = () => {
    // eslint-disable-next-line no-console
    console.log(
      'minimizeApp clicked',
      JSON.stringify({
        overlayExists: !!(window as unknown as { overlay?: unknown }).overlay,
        electronAPIExists: !!recallElectronAPI
      })
    )
    const overlay = (window as unknown as { overlay?: { minimizeApp?: () => void } }).overlay
    if (overlay?.minimizeApp) {
      overlay.minimizeApp()
      return
    }
    recallElectronAPI?.send('minimize-app', undefined)
  }

  const openExternal = (url: string) => {
    const overlay = (window as unknown as { overlay?: { openExternal?: (u: string) => void } }).overlay
    if (overlay?.openExternal) {
      overlay.openExternal(url)
      return
    }
    recallElectronAPI?.send('open-external', url)
  }

  const copyToClipboard = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 2000)
    })
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'transparent' : 'dark'
    setTheme(newTheme)
    document.body.style.backgroundColor = 'transparent'
  }

  const openDashboard = () => {
    openExternal('http://vitt-health-insurance.netlify.app/')
  }

  const userid = (currentUser as { userid?: string; id?: string })?.userid ?? (currentUser as { id?: string })?.id ?? ''
  const sessionid = (currentUser as { sessionuid?: string })?.sessionuid ?? (sessionuidRef.current ?? '')

  return (
    <div>
      <div
        className="card app4-card"
        id="card"
        data-theme={theme}
        style={{ ['--bg-opacity' as string]: 0.85 }}
      >
        <div className="app4-header drag-region">
          <div className="app4-title">
            <span className="dot" />
            <span>Vitt Overlay</span>
          </div>
          <div className="app4-actions no-drag">
            <button type="button" className="btn-icon" onClick={openDashboard} title="Dashboard">
              <LayoutDashboard size={18} />
            </button>
            <button type="button" className="btn-icon" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'dark' ? <SunMedium size={18} /> : <SunMoon size={18} />}
            </button>
            <button type="button" className="btn-icon" onClick={minimizeApp} title="Minimize">
              <Minus size={18} />
            </button>
            <button type="button" className="btn-icon danger" onClick={closeApp} title="Quit">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="no-drag" style={{ padding: '0 12px 2px', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
          {currentTime}
        </div>
        <div className="no-drag" style={{ padding: '0 12px 6px', fontSize: 11, color: isServerConnected ? '#22c55e' : '#ef4444' }}>
          {isServerConnected ? 'Server Connected' : 'Server Disconnected'}
        </div>

        <div className="status-section no-drag"></div>

        {/* Recording controls intentionally hidden (Recall flow removed). */}
        {/* {selectedTab !== 'settings' && <div className="controls-section no-drag">...</div>} */}

        <div className="list-container no-drag" style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {/* {selectedTab === 'transcript' && <TranscriptionList />} */}
          {/* {selectedTab === 'prompts' && <PromptList />} */}
          {/* {selectedTab === 'uploads' && <UploadsTab sdkState={sdkState} />} */}
          {selectedTab === 'chat' && (
            <ChatWithAITab setCopyToast={setCopyToast} userid={userid} sessionid={sessionid} />
          )}
          {/* {selectedTab === 'settings' && (
            <SettingsTab transparency={transparency} setTransparency={setTransparency} openExternal={openExternal} />
          )} */}
        </div>

        {/* Tabs intentionally hidden from UI (including AI tab icon). */}

        <div className="toast-container">
          <div className={`toast ${copyToast ? 'visible' : ''}`}>Copied to clipboard</div>
        </div>
        <div className="bottom-hint no-drag">
          Click-through: <b id="state">ON</b> • ⌥ + `
        </div>
      </div>
    </div>
  )
}
