import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import './App.css'
import './App5.css'
import { addTranscription } from './redux/reducers/TranscriptionReducer'
import { addPrompt } from './redux/reducers/promptsReducer'
import { addConversationTurn, addIncomingMessages, addOutgoingMessage } from './redux/reducers/chatWithAIReducer'
import parse from 'html-react-parser'
import ReactHtmlParser from 'html-react-parser'
import {
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  Mic,
  Minus,
  Pause,
  Send,
  SunMedium,
  SunMoon,
  UploadCloud,
  X
} from 'lucide-react'
import { useData } from './context/DataWrapper'
import { useAuth } from './context/AuthContext'
import { getTimeStamp } from './functions/generalFn'
import type { ChatMessage } from './redux/reducers/chatWithAIReducer'

/** Single shared WebSocket for the app so only one connection exists. */
let appSharedWs: WebSocket | null = null

const CHAT_RESPONSE_TIMEOUT_MS = 15000
const AI_ASSIST_FALLBACK_PATTERNS = [
  /I did not catch enough speech to generate a support suggestion\.?/gi
]

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatInlineMarkdown(text: string) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function sanitizeAiAssistText(raw: string) {
  let text = raw

  for (const pattern of AI_ASSIST_FALLBACK_PATTERNS) {
    text = text.replace(pattern, ' ')
  }

  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function formatAiAssistContent(raw: string) {
  const sanitized = sanitizeAiAssistText(raw)

  if (!sanitized) {
    return ''
  }

  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(sanitized)
  if (hasHtml) {
    return sanitized
  }

  const lines = sanitized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return ''
  }

  const blocks: string[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(`<ul>${listItems.join('')}</ul>`)
      listItems = []
    }
  }

  for (const line of lines) {
    if (/^[-*]\s+/.test(line)) {
      listItems.push(`<li>${formatInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }

    flushList()
    blocks.push(`<p>${formatInlineMarkdown(line)}</p>`)
  }

  flushList()

  return blocks.join('')
}

function TranscriptionList() {
  const transcriptions = useSelector((state: { transcriptionReducer: { transcriptions: { speaker?: string; transcription: string }[] } }) => state.transcriptionReducer.transcriptions)

  return (
    <div className="content-list">
      {transcriptions.map((entry, index) => (
        <TranscriptionItem e={entry} key={index} />
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

function PromptList({
  userid,
  sessionid
}: {
  userid: string
  sessionid: string
}) {
  const { wsRef } = (useData() as unknown) as { wsRef: React.MutableRefObject<WebSocket | null> }
  const prompts = useSelector((state: { promptsReducer: { prompts: { prompt: string }[] } }) => state.promptsReducer.prompts)
  const [isTriggering, setIsTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onResponse = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setIsTriggering(false)
    }

    window.addEventListener('chat-response-received', onResponse)
    return () => {
      window.removeEventListener('chat-response-received', onResponse)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const triggerPrompt = () => {
    if (isTriggering) return

    const ws = (wsRef as React.MutableRefObject<WebSocket | null>).current
    if (ws?.readyState !== WebSocket.OPEN) {
      setTriggerError('Backend not connected.')
      return
    }

    setTriggerError('')
    setIsTriggering(true)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      setIsTriggering(false)
      setTriggerError('Request timed out.')
    }, CHAT_RESPONSE_TIMEOUT_MS)

    ws.send(
      JSON.stringify({
        type: 'suggest_me_next',
        userid,
        sessionid,
        query: '',
        timestamp: getTimeStamp(),
        prompt_trigger: true
      })
    )
  }

  return (
    <div className="content-list">
      <div className="prompt-toolbar">
        <button type="button" className="prompt-trigger-btn" onClick={triggerPrompt} disabled={isTriggering}>
          {isTriggering ? 'Triggering...' : 'Suggest'}
        </button>
        {triggerError ? <div className="prompt-trigger-status error">{triggerError}</div> : null}
      </div>
      {prompts.length === 0 ? (
        <div className="prompt-empty">
          <div className="prompt-empty-title">No AI Assist results yet</div>
          <div className="prompt-empty-text">Use the Suggest button above to trigger AI Assist.</div>
        </div>
      ) : null}
      {prompts.map((entry, index) => (
        <PromptItem e={entry} key={index} />
      ))}
    </div>
  )
}

function PromptItem({ e }: { e: { prompt: string } }) {
  const formattedPrompt = formatAiAssistContent(e.prompt)

  if (!formattedPrompt) {
    return null
  }

  return (
    <div className="prompt-card">
      <div className="prompt-card-header">
        <span className="prompt-card-badge">AI Assist</span>
      </div>
      <div className="transcription-text prompt-card-body">{parse(formattedPrompt)}</div>
    </div>
  )
}

function DataInfoList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <div className="content-list">
        <div className="data-info-empty">
          <div className="data-info-empty-title">No data yet</div>
          <div className="data-info-empty-text">Latest backend data will appear here.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="content-list">
      {items.map((entry, index) => (
        <DataInfoItem entry={entry} index={index} key={`${index}-${entry.slice(0, 24)}`} />
      ))}
    </div>
  )
}

function DataInfoItem({ entry, index }: { entry: string; index: number }) {
  const trimmedEntry = entry.trim()
  let formattedJson: string | null = null

  if (
    (trimmedEntry.startsWith('{') && trimmedEntry.endsWith('}')) ||
    (trimmedEntry.startsWith('[') && trimmedEntry.endsWith(']'))
  ) {
    try {
      formattedJson = JSON.stringify(JSON.parse(trimmedEntry), null, 2)
    } catch {
      formattedJson = null
    }
  }

  return (
    <div className="data-info-card">
      <div className="data-info-card-header">
        <span className="data-info-badge">Data</span>
        <span className="data-info-item-label">Item {index + 1}</span>
      </div>
      {formattedJson ? (
        <pre className="data-info-code">{formattedJson}</pre>
      ) : (
        <div className="transcription-text data-info-text">{parse(entry)}</div>
      )}
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

function SettingsTab({
  transparency,
  setTransparency,
  currentUser,
  openExternal
}: {
  transparency: number
  setTransparency: (v: number) => void
  currentUser: { userid?: string; id?: string } | null
  openExternal: (url: string) => void
}) {
  const [language, setLanguage] = useState('english')
  const displayUserId = currentUser?.userid ?? currentUser?.id ?? 'N/A'

  return (
    <div className="content-list settings-tab">
      <div className="setting-section">
        <div className="setting-header">Profile</div>
        <div className="setting-row">
          <span className="setting-label">User ID</span>
          <span className="setting-value">{displayUserId}</span>
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

function ChatWithAITab({
  userid,
  sessionid
}: {
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

export default function App() {
  const recallElectronAPI = (window as unknown as { electronAPI?: { ipcRenderer: { on: (c: string, h: (s: unknown) => void) => void; send: (c: string, p: unknown) => void; removeAllListeners: (c: string) => void } } }).electronAPI?.ipcRenderer
  const wsUrl = 'ws://localhost:5000/ws'
  const [selectedTab, setSelectedTab] = useState('transcript')
  const [theme, setTheme] = useState('transparent')
  const [transparency, setTransparency] = useState(85)
  const [currentTime, setCurrentTime] = useState('')
  const [isServerConnected, setIsServerConnected] = useState(false)
  const [dataInfoItems, setDataInfoItems] = useState<string[]>([])
  const [sdkState, setSdkState] = useState({
    recording: false,
    permissions_granted: true,
    meetings: [] as { id: string; title: string; status: string; uploadPercentage?: number }[]
  })
  const [detectedMeeting, setDetectedMeeting] = useState<{
    window?: { id?: string; title?: string; url?: string; platform?: string }
  } | null>(null)

  const { currentUser } = (useAuth() as unknown) as { currentUser: { userid?: string; id?: string; sessionuid?: string } | null }
  const { wsRef } = (useData() as unknown) as { wsRef: React.MutableRefObject<WebSocket | null> }
  const currentUserRef = useRef(currentUser)
  const sessionuidRef = useRef((currentUser as { sessionuid?: string })?.sessionuid)

  useEffect(() => {
    console.log(
      'App init - bridge debug',
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
    recallElectronAPI.on('meeting-detected', (evt: unknown) => setDetectedMeeting(evt as typeof detectedMeeting))
    recallElectronAPI.on('meeting-closed', () => setDetectedMeeting(null))
    recallElectronAPI.send('message-from-renderer', { command: 'renderer-ready' })
    return () => {
      recallElectronAPI.removeAllListeners('state')
      recallElectronAPI.removeAllListeners('meeting-detected')
      recallElectronAPI.removeAllListeners('meeting-closed')
    }
  }, [])

  const dispatch = useDispatch()
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  useEffect(() => {
    const ref = wsRef as React.MutableRefObject<WebSocket | null>
    if (appSharedWs && (appSharedWs.readyState === WebSocket.OPEN || appSharedWs.readyState === WebSocket.CONNECTING)) {
      ref.current = appSharedWs
      return () => {
        ref.current = null
      }
    }

    if (ref.current != null) return () => { ref.current = null }

    let tempWs: WebSocket
    const reconnectInterval = 1000

    function connect() {
      if (appSharedWs && (appSharedWs.readyState === WebSocket.OPEN || appSharedWs.readyState === WebSocket.CONNECTING)) {
        ref.current = appSharedWs
        return
      }

      tempWs = new WebSocket(wsUrl)
      appSharedWs = tempWs
      ref.current = tempWs

      tempWs.onopen = () => {
        setIsServerConnected(true)
        tempWs.send('Hello from browser!')
      }

      tempWs.onmessage = (event: MessageEvent) => {
        try {
          const result = JSON.parse(event.data as string) as Record<string, unknown>
          console.log("result is ",result)
          const d = dispatchRef.current
          const nestedData =
            result.data && typeof result.data === 'object'
              ? (result.data as Record<string, unknown>)
              : null

          if (result.type === 'transcript') {
            const text = (result.text ?? result.transcription) as string | undefined
            const speaker = result.speaker as string | undefined
            d(addTranscription({ ...result, text: text ?? '', speaker }))
          }

          const rawDataInfo = result.data_info ?? nestedData?.data_info
          const nextDataInfoItems = Array.isArray(rawDataInfo)
            ? rawDataInfo
                .map((item) =>
                  typeof item === 'string'
                    ? item.trim()
                    : typeof item === 'object' && item != null
                      ? JSON.stringify(item, null, 2)
                      : String(item ?? '').trim()
                )
                .filter(Boolean)
            : typeof rawDataInfo === 'string'
              ? (rawDataInfo.trim() ? [rawDataInfo.trim()] : [])
              : typeof rawDataInfo === 'object' && rawDataInfo != null
                ? [JSON.stringify(rawDataInfo, null, 2)]
                : []

          if (rawDataInfo !== undefined) {
            setDataInfoItems(nextDataInfoItems)
          }

          if (result.type === 'chat-with-ai-response' || result.event === 'chat-with-ai-response') {
            const transcript = (result.transcript ?? nestedData?.transcript) as string | undefined
            const aiPrompt = (result.ai_prompt ?? nestedData?.ai_prompt ?? result.support_reply ?? nestedData?.support_reply) as string | undefined
            const aiChat = (result.ai_chat ?? nestedData?.ai_chat ?? result.support_reply ?? nestedData?.support_reply) as string | undefined
            const rawContent = result.content ?? nestedData?.content
            const content = (Array.isArray(rawContent)
              ? (rawContent as string[])
              : typeof rawContent === 'string' && rawContent.trim()
                ? [rawContent]
                : []
            ).filter((item) => item.trim() && item.trim() !== aiChat?.trim())
            const res_timestamp = (result.res_timestamp ?? nestedData?.res_timestamp) as string | undefined

            if (transcript?.trim()) {
              d(
                addTranscription({
                  text: transcript.trim(),
                  speaker: (result.speaker ?? nestedData?.speaker) as string | undefined
                })
              )
            }

            const cleanedAiPrompt = aiPrompt ? sanitizeAiAssistText(aiPrompt) : ''

            if (cleanedAiPrompt) {
              d(addPrompt({ text: cleanedAiPrompt }))
            }

            if (transcript || aiChat) {
              d(
                addConversationTurn({
                  transcript,
                  support_reply: aiChat,
                  res_timestamp
                })
              )
            }

            if (content.length > 0) {
              d(addIncomingMessages({ content, res_timestamp }))
            }

            window.dispatchEvent(new CustomEvent('chat-response-received'))
          }
        } catch {
          /* ignore non-json */
        }
      }

      tempWs.onclose = () => {
        setIsServerConnected(false)
        appSharedWs = null
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
    const overlay = (window as unknown as { overlay?: { quitApp?: () => void } }).overlay
    if (overlay?.quitApp) {
      overlay.quitApp()
      return
    }
    recallElectronAPI?.send('close-app', undefined)
  }

  const minimizeApp = () => {
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

        {detectedMeeting && (
          <div
            className="no-drag meeting-detected-banner"
            style={{
              margin: '4px 12px 6px',
              padding: '8px 10px',
              borderRadius: 8,
              background: sdkState.recording
                ? 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))'
                : 'linear-gradient(135deg, rgba(96,165,250,0.18), rgba(96,165,250,0.08))',
              border: `1px solid ${sdkState.recording ? 'rgba(34,197,94,0.45)' : 'rgba(96,165,250,0.45)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: sdkState.recording ? '#22c55e' : '#60a5fa',
                boxShadow: sdkState.recording ? '0 0 6px #22c55e' : '0 0 6px #60a5fa',
                animation: 'pulse 1.4s ease-in-out infinite'
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
                {sdkState.recording ? 'Recording meeting' : 'Meeting detected'}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.7)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={detectedMeeting.window?.title || detectedMeeting.window?.url || ''}
              >
                {detectedMeeting.window?.platform ? `${detectedMeeting.window.platform} · ` : ''}
                {detectedMeeting.window?.title || detectedMeeting.window?.url || 'Unknown meeting'}
              </div>
            </div>
            {!sdkState.recording ? (
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '4px 10px', fontSize: 11, minHeight: 0 }}
                onClick={() => recallElectronAPI?.send('message-from-renderer', { command: 'start-recording' })}
              >
                <Mic size={12} /> Record
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '4px 10px', fontSize: 11, minHeight: 0 }}
                onClick={() => recallElectronAPI?.send('message-from-renderer', { command: 'stop-recording' })}
              >
                <Pause size={12} /> Stop
              </button>
            )}
          </div>
        )}

        <div className="no-drag" style={{ padding: '0 12px 2px', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
          {currentTime}
        </div>
        <div className="no-drag" style={{ padding: '0 12px 6px', fontSize: 11, color: isServerConnected ? '#22c55e' : '#ef4444' }}>
          {isServerConnected ? 'Server Connected' : 'Server Disconnected'}
        </div>

        <div className="status-section no-drag" />

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
          {selectedTab === 'uploads' && <UploadsTab sdkState={sdkState} />}
          {selectedTab === 'chat' && <ChatWithAITab userid={userid} sessionid={sessionid} />}
          {selectedTab === 'prompts' && <PromptList userid={userid} sessionid={sessionid} />}
          {selectedTab === 'data_info' && <DataInfoList items={dataInfoItems} />}
          {selectedTab === 'settings' && (
            <SettingsTab
              transparency={transparency}
              setTransparency={setTransparency}
              currentUser={currentUser}
              openExternal={openExternal}
            />
          )}
        </div>

        <div className="tab-bar no-drag" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
          <TabButton active={selectedTab === 'transcript'} onClick={() => setSelectedTab('transcript')} icon="📝" label="Transcript" />
          <TabButton active={selectedTab === 'uploads'} onClick={() => setSelectedTab('uploads')} icon="☁️" label="Uploads" />
          <TabButton active={selectedTab === 'chat'} onClick={() => setSelectedTab('chat')} icon="🤖" label="AI Chat" />
          <TabButton active={selectedTab === 'prompts'} onClick={() => setSelectedTab('prompts')} icon="📊" label="AI Assist" />
          <TabButton active={selectedTab === 'data_info'} onClick={() => setSelectedTab('data_info')} icon="ℹ️" label="Data" />
          <TabButton active={selectedTab === 'settings'} onClick={() => setSelectedTab('settings')} icon="⚙️" label="Settings" />
        </div>

        <div className="bottom-hint no-drag">
          Click-through: <b id="state">ON</b> • Alt + `
        </div>
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
