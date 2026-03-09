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
  Mic,
  Pause,
  Copy,
  SunMoon,
  SunMedium,
  Link2,
  Minus,
  LayoutDashboard,
  X,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Send,
  Loader2
} from 'lucide-react'
import { useData } from './context/DataWrapper'
import { useAuth } from './context/AuthContext'
import { getTimeStamp } from './functions/generalFn'
import GMeetIcon from './assets/g-meet.png'
import ZoomIcon from './assets/zoom.png'
import TeamsIcon from './assets/teams.png'
import type { ChatMessage } from './redux/reducers/chatWithAIReducer'

/** Single shared WebSocket for the app so only one connection exists. */
let app5SharedWs: WebSocket | null = null

// --- Components ---

function TranscriptionList() {
  const transcriptions = useSelector((state: { transcriptionReducer: { transcriptions: { speaker?: string; transcription: string }[] } }) => state.transcriptionReducer.transcriptions)
  return (
    <div className="content-list">
      {transcriptions.map((e, i) => (
        <TranscriptionItem e={e} key={i} />
      ))}
    </div>
  )
}

function TranscriptionItem({ e }: { e: { speaker?: string; transcription: string } }) {
  return (
    <div className="transcription-card">
      {e.speaker && <div className="transcription-header">{e.speaker}</div>}
      <div className="transcription-text">{e.transcription}</div>
    </div>
  )
}

function PromptList() {
  const prompts = useSelector((state: { promptsReducer: { prompts: { prompt: string }[] } }) => state.promptsReducer.prompts)
  return (
    <div className="content-list">
      {prompts?.map((e: { prompt: string }, i: number) => (
        <PromptItem e={e} key={i} />
      ))}
    </div>
  )
}

function PromptItem({ e }: { e: { prompt: string } }) {
  return (
    <div className="transcription-card" style={{ background: 'rgba(116, 255, 160, 0.05)', borderColor: 'rgba(116, 255, 160, 0.2)' }}>
      <div className="transcription-text">{parse(e.prompt)}</div>
    </div>
  )
}

function UploadsTab({ sdkState }: { sdkState: { meetings: { id: string; title: string; status: string; uploadPercentage?: number }[] } }) {
  const [selectedMeeting, setSelectedMeeting] = useState<{ id: string } | null>(null)

  const StatusIcon = ({ status }: { status: string }) => {
    const props = { size: 20, strokeWidth: 2 }
    switch (status) {
      case 'completed':
        return <CheckCircle2 {...props} color="var(--accent)" />
      case 'failed':
        return <AlertCircle {...props} color="var(--danger)" />
      case 'in-progress':
        return <UploadCloud {...props} color="#60a5fa" />
      case 'paused':
        return <Pause {...props} color="var(--text-muted)" />
      default:
        return null
    }
  }

  return (
    <div className="content-list">
      {(sdkState.meetings || []).map((meeting) => (
        <div
          key={meeting.id}
          className="transcription-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            borderColor: selectedMeeting?.id === meeting.id ? 'var(--accent)' : 'var(--border-glass)'
          }}
          onClick={() => setSelectedMeeting(meeting)}
        >
          <StatusIcon status={meeting.status} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{meeting.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{meeting.id}</div>
            {meeting.uploadPercentage != null && (
              <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>{meeting.uploadPercentage}% Uploaded</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

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
          <button
            type="button"
            className="chat-send-btn"
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            title="Send"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsTab({
  transparency,
  setTransparency,
  openExternal
}: {
  transparency: number
  setTransparency: (v: number) => void
  openExternal: (url: string) => void
}) {
  const [language, setLanguage] = useState('english')

  return (
    <div className="content-list settings-tab">
      <div className="setting-section">
        <div className="setting-header">Profile</div>
        <div className="setting-row">
          <span className="setting-label">User ID</span>
          <span className="setting-value">user_12345</span>
        </div>
        <div className="setting-row">
          <span className="setting-label">Email</span>
          <span className="setting-value">user@example.com</span>
        </div>
        <div className="setting-row">
          <span className="setting-label">Mobile</span>
          <span className="setting-value">xxxxx92</span>
        </div>
        <div className="setting-row">
          <span className="setting-label">Plan</span>
          <span className="setting-value" style={{ color: 'var(--accent)' }}>Premium</span>
        </div>
      </div>

      <div className="setting-section">
        <div className="setting-header">Preferences</div>
        <div className="setting-row">
          <span className="setting-label">Language</span>
          <select
            className="setting-input"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="marathi">Marathi</option>
          </select>
        </div>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span className="setting-label">Transparency</span>
            <span className="setting-value">{transparency}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            value={transparency}
            onChange={(e) => setTransparency(Number(e.target.value))}
            className="setting-slider"
          />
        </div>
      </div>

      <div className="setting-section">
        <div className="setting-header">About</div>
        <div className="setting-row">
          <span className="setting-label">App Version</span>
          <span className="setting-value">1.0.2</span>
        </div>
        <div className="setting-row">
          <span className="setting-label">Last Login</span>
          <span className="setting-value">Today, 10:30 AM</span>
        </div>
        <div className="setting-row" style={{ marginTop: 8 }}>
          <span className="link-btn" onClick={() => openExternal('https://vitt-health-insurance.netlify.app/reset-password')}>
            Change Password
          </span>
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
  const [selectedTab, setSelectedTab] = useState('transcript')
  const [theme, setTheme] = useState('transparent')
  const [transparency, setTransparency] = useState(85)
  const [copyToast, setCopyToast] = useState(false)
  const [meetingId, setMeetingId] = useState('')
  const [meetings, setMeetings] = useState<{ id: string; platform: string; url?: string }[]>([])
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null)
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
    currentUserRef.current = currentUser
    sessionuidRef.current = (currentUser as { sessionuid?: string })?.sessionuid
  }, [currentUser])

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
      tempWs.onopen = () => tempWs.send('Hello from browser!')
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
        app5SharedWs = null
        ref.current = null
        setTimeout(connect, reconnectInterval)
      }
    }
    connect()
    return () => {
      ref.current = null
    }
  }, [])

  useEffect(() => {
    if (!recallElectronAPI || !(window as unknown as { overlay?: unknown }).overlay) return
    const overlay = (window as unknown as { overlay: { getRecallBuffer: (cb: (d: unknown) => void) => () => void; getMeetingId: (cb: (id: string) => void) => () => void; meetingDetected: (cb: (e: { window?: { id: string; platform: string; url?: string } }) => void) => () => void } }).overlay
    const unsubBuffer = overlay.getRecallBuffer((data: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'recall-buffer',
            userid: currentUserRef.current?.id ?? (currentUserRef.current as { userid?: string })?.userid,
            sessionid: sessionuidRef.current,
            data,
            timestamp: getTimeStamp()
          })
        )
      }
    })
    const unsubMeetingId = overlay.getMeetingId((id: string) => {
      setMeetingId(id)
      const el = document.getElementById('meeting_id')
      if (el) el.innerText = id
    })
    const unsubMeetingDetected = overlay.meetingDetected((e: { window?: { id: string; platform: string; url?: string } }) => {
      const newMeeting = e.window
      if (!newMeeting) return
      setMeetings((prev) => {
        if (prev.find((m) => m.id === newMeeting.id)) return prev
        const updated = [...prev, newMeeting]
        if (updated.length === 1) setActiveMeetingId(newMeeting.id)
        return updated
      })
    })
    return () => {
      if (typeof unsubBuffer === 'function') unsubBuffer()
      if (typeof unsubMeetingId === 'function') unsubMeetingId()
      if (typeof unsubMeetingDetected === 'function') unsubMeetingDetected()
    }
  }, [])

  useEffect(() => {
    if (meetings.length === 0) return
    const currentActiveExists = activeMeetingId != null && meetings.some((m) => m.id === activeMeetingId)
    if (!currentActiveExists) setActiveMeetingId(meetings[0].id)
  }, [meetings, activeMeetingId])

  const closeApp = () => (window as unknown as { overlay?: { quitApp: () => void } }).overlay?.quitApp()
  const minimizeApp = () => (window as unknown as { overlay?: { minimizeApp: () => void } }).overlay?.minimizeApp?.()
  const openExternal = (url: string) => (window as unknown as { overlay?: { openExternal: (u: string) => void } }).overlay?.openExternal?.(url)

  const copyToClipboard = (text?: string) => {
    const val = text ?? meetingId
    if (!val) return
    navigator.clipboard.writeText(val).then(() => {
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

  const getIconForPlatform = (platform: string) => {
    if (platform === 'zoom') return ZoomIcon
    if (platform === 'google-meet') return GMeetIcon
    if (platform === 'teams') return TeamsIcon
    return null
  }

  const renderMeetingStatus = () => {
    if (activeMeetingId) {
      const meeting = meetings.find((m) => m.id === activeMeetingId)
      if (!meeting) return null
      const icon = getIconForPlatform(meeting.platform)
      const name = meeting.platform === 'google-meet' ? 'Google Meet' : meeting.platform?.charAt(0).toUpperCase() + meeting.platform?.slice(1)
      return (
        <div className="meeting-card">
          <div className="meeting-card-close" onClick={() => setActiveMeetingId(null)}>
            <X size={12} />
          </div>
          <div className="meeting-info">
            <div className="meeting-icon">
              <img src={icon ?? ''} alt={name} />
            </div>
            <div className="meeting-details">
              <span className="meeting-label">Meeting Detected</span>
              <span className="meeting-platform">{name}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-icon" onClick={() => copyToClipboard(meeting.id)} title="Copy ID">
              <Copy size={16} />
            </button>
            <button type="button" className="btn-icon" onClick={() => copyToClipboard(meeting.url)} title="Copy Link">
              <Link2 size={16} />
            </button>
          </div>
        </div>
      )
    }
    if (meetings.length > 0) {
      return (
        <div className="meeting-list">
          <span className="meeting-list-label">Meetings:</span>
          {meetings.map((m) => (
            <div key={m.id} className="meeting-list-item" onClick={() => setActiveMeetingId(m.id)} title={`Open ${m.platform}`}>
              <img src={getIconForPlatform(m.platform) ?? ''} alt={m.platform} />
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="drag-region">
      <div
        className="card app4-card drag-region"
        id="card"
        data-theme={theme}
        style={{ ['--bg-opacity' as string]: transparency / 100 }}
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

        <div className="status-section no-drag">
          {meetingId && (
            <div className="meeting-id-box">
              <span id="meeting_id" className="meeting-id-text">
                {meetingId}
              </span>
              <div className="copy-btn" onClick={() => copyToClipboard(meetingId)}>
                <Copy size={14} />
              </div>
            </div>
          )}
          {renderMeetingStatus()}
        </div>

        {selectedTab !== 'settings' && (
          <div className="controls-section no-drag">
            {sdkState.permissions_granted ? (
              <>
                <button
                  type="button"
                  className={`btn-primary ${sdkState.recording ? 'recording' : ''}`}
                  disabled={sdkState.recording}
                  onClick={() => recallElectronAPI?.send('message-from-renderer', { command: 'start-recording' })}
                >
                  <Mic size={18} />
                  {sdkState.recording ? 'Recording...' : 'Start Recording'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!sdkState.recording}
                  onClick={() => recallElectronAPI?.send('message-from-renderer', { command: 'stop-recording' })}
                >
                  <Pause size={18} />
                  Pause
                </button>
              </>
            ) : (
              <div style={{ width: '100%', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                Permissions required. Check Settings.
              </div>
            )}
          </div>
        )}

        <div className="list-container no-drag" style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {selectedTab === 'transcript' && <TranscriptionList />}
          {selectedTab === 'prompts' && <PromptList />}
          {selectedTab === 'uploads' && <UploadsTab sdkState={sdkState} />}
          {selectedTab === 'chat' && (
            <ChatWithAITab setCopyToast={setCopyToast} userid={userid} sessionid={sessionid} />
          )}
          {selectedTab === 'settings' && (
            <SettingsTab transparency={transparency} setTransparency={setTransparency} openExternal={openExternal} />
          )}
        </div>

        <div className="tab-bar no-drag">
          <TabButton active={selectedTab === 'transcript'} onClick={() => setSelectedTab('transcript')} icon="📝" label="Transcript" />
          <TabButton active={selectedTab === 'uploads'} onClick={() => setSelectedTab('uploads')} icon="☁️" label="Uploads" />
          <TabButton active={selectedTab === 'chat'} onClick={() => setSelectedTab('chat')} icon="🤖" label="AI Chat" />
          <TabButton active={selectedTab === 'prompts'} onClick={() => setSelectedTab('prompts')} icon="📊" label="Prompts" />
          <TabButton active={selectedTab === 'settings'} onClick={() => setSelectedTab('settings')} icon="⚙️" label="Settings" />
        </div>

        <div className="toast-container">
          <div className={`toast ${copyToast ? 'visible' : ''}`}>Copied to clipboard</div>
        </div>
        {selectedTab !== 'settings' && (
          <div className="bottom-hint no-drag">
            Click-through: <b id="state">ON</b> • ⌥ + `
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <button type="button" className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
    </button>
  )
}
