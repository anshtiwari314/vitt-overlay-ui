import React, { useEffect, useRef, useState, useLayoutEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'
import './App.css'
import { addTranscription, clearTranscriptions } from './redux/reducers/TranscriptionReducer'
import { addPrompt, clearPrompts } from './redux/reducers/promptsReducer'
import { addConversationTurn, addIncomingMessages, addOutgoingMessage, clearChat } from './redux/reducers/chatWithAIReducer'
import parse from 'html-react-parser'
import ReactHtmlParser from 'html-react-parser'
import {
  AlertCircle,
  BotMessageSquare,
  CheckCircle2,
  Copy,
  Database,
  FileText,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  Mic,
  Minus,
  Pause,
  Settings,
  RefreshCw,
  Sparkles,
  SunMedium,
  SunMoon,
  UploadCloud,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { useData } from './context/DataWrapper'
import { useAuth } from './context/AuthContext'
import { getTimeStamp } from './functions/generalFn'
import { useServerUrl } from './context/ServerUrlContext'
import WindowResizeButton from './components/WindowResizeButton'
import GMeetIcon from './assets/g-meet.png'
import ZoomIcon from './assets/zoom.png'
import TeamsIcon from './assets/teams.png'
import type { ChatMessage } from './redux/reducers/chatWithAIReducer'

export type DataInfoField = {
  id: string
  label: string
  value?: string
  is_editable?: boolean | string
  is_copyable?: boolean | string
  type?: 'text' | 'textarea' | 'option'
  options?: string[]
}

function getMeetingPlatformIcon(platform?: string | null) {
  if (!platform) return null
  const key = platform.toLowerCase()
  if (key === 'zoom') return ZoomIcon
  if (key === 'google-meet' || key === 'google_meet' || key === 'googlemeet' || key === 'meet') return GMeetIcon
  if (key === 'teams' || key === 'msteams' || key === 'microsoft-teams') return TeamsIcon
  return null
}

function getMeetingPlatformLabel(platform?: string | null) {
  if (!platform) return 'Unknown'
  const key = platform.toLowerCase()
  if (key === 'zoom') return 'Zoom'
  if (key === 'google-meet' || key === 'google_meet' || key === 'googlemeet' || key === 'meet') return 'Google Meet'
  if (key === 'teams' || key === 'msteams' || key === 'microsoft-teams') return 'Microsoft Teams'
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

/** Single shared WebSocket for the app so only one connection exists. */
let appSharedWs: WebSocket | null = null

const CHAT_RESPONSE_TIMEOUT_MS = 15000
const AI_ASSIST_FALLBACK_PATTERNS = [
  /I did not catch enough speech to generate a support suggestion\.?/gi
]

const SCROLL_LOCK_THRESHOLD = 80
const HIGHLIGHT_DURATION_MS = 10000

type ScrollLockApi = {
  ref: React.RefObject<HTMLDivElement | null>
  unseenCount: number
  scrollToFollow: () => void
  isHighlighted: (indexFromFollow: number) => boolean
}

function useScrollLock<T>(items: T[], mode: 'top' | 'bottom', threshold: number = SCROLL_LOCK_THRESHOLD): ScrollLockApi {
  const ref = useRef<HTMLDivElement>(null)
  const prevHeightRef = useRef(0)
  const prevLengthRef = useRef(0)
  const followRef = useRef(true)
  const initRef = useRef(false)
  const [unseenCount, setUnseenCount] = useState(0)
  const [highlightCount, setHighlightCount] = useState(0)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFollowing = useCallback(() => {
    const el = ref.current
    if (!el) return true
    if (mode === 'top') return el.scrollTop <= threshold
    return el.scrollHeight - el.clientHeight - el.scrollTop <= threshold
  }, [mode, threshold])

  const markSeen = useCallback(() => {
    setUnseenCount((prev) => {
      if (prev > 0) {
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
        setHighlightCount(prev)
        highlightTimerRef.current = setTimeout(() => {
          setHighlightCount(0)
          highlightTimerRef.current = null
        }, HIGHLIGHT_DURATION_MS)
      }
      return 0
    })
  }, [])

  const scrollToFollow = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (mode === 'top') el.scrollTop = 0
    else el.scrollTop = el.scrollHeight
    followRef.current = true
    markSeen()
  }, [mode, markSeen])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const following = isFollowing()
      followRef.current = following
      if (following) markSeen()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [isFollowing, markSeen])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!initRef.current) {
      if (mode === 'top') el.scrollTop = 0
      else el.scrollTop = el.scrollHeight
      prevHeightRef.current = el.scrollHeight
      prevLengthRef.current = items.length
      initRef.current = true
      return
    }
    const lengthDelta = items.length - prevLengthRef.current
    if (followRef.current) {
      if (mode === 'top') el.scrollTop = 0
      else el.scrollTop = el.scrollHeight
    } else {
      if (mode === 'top') {
        const diff = el.scrollHeight - prevHeightRef.current
        if (diff > 0) el.scrollTop += diff
      }
      if (lengthDelta > 0) {
        setUnseenCount((prev) => prev + lengthDelta)
      }
    }
    prevHeightRef.current = el.scrollHeight
    prevLengthRef.current = items.length
  }, [items, mode])

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
  }, [])

  const isHighlighted = useCallback((indexFromFollow: number) => {
    return indexFromFollow < highlightCount
  }, [highlightCount])

  return { ref, unseenCount, scrollToFollow, isHighlighted }
}

function NewMessagesIndicator({
  count,
  mode,
  onClick
}: {
  count: number
  mode: 'top' | 'bottom'
  onClick: () => void
}) {
  if (count <= 0) return null
  const Icon = mode === 'top' ? ChevronUp : ChevronDown
  return (
    <button
      type="button"
      className={`new-messages-indicator new-messages-indicator-${mode}`}
      onClick={onClick}
    >
      <Icon size={14} />
      <span>{count} new {count === 1 ? 'message' : 'messages'}</span>
    </button>
  )
}

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

function normalizeSocketEventName(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase().replace(/[_\s]+/g, '-')
}

function isChatWithAiResponseEvent(
  result: Record<string, unknown>,
  nestedData: Record<string, unknown> | null
) {
  const eventCandidates = [
    result.type,
    result.event,
    nestedData?.type,
    nestedData?.event
  ]

  return eventCandidates.some((candidate) => {
    const normalized = normalizeSocketEventName(candidate)
    return normalized === 'chat-with-ai-response' || normalized === 'chat-with-ai-response-event'
  })
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
  const { ref, unseenCount, scrollToFollow, isHighlighted } = useScrollLock(transcriptions, 'top')

  return (
    <div className="list-wrap">
      <div className="content-list" ref={ref}>
        {transcriptions.map((entry, index) => (
          <TranscriptionItem e={entry} key={index} highlighted={isHighlighted(index)} />
        ))}
      </div>
      <NewMessagesIndicator count={unseenCount} mode="top" onClick={scrollToFollow} />
    </div>
  )
}

function TranscriptionItem({ e, highlighted }: { e: { speaker?: string; transcription: string }; highlighted?: boolean }) {
  return (
    <div className={`transcription-card${highlighted ? ' highlight-new' : ''}`}>
      {e.speaker && <div className="transcription-header">{e.speaker}</div>}
      <div className="transcription-text">{e.transcription}</div>
    </div>
  )
}

function PromptList() {
  const prompts = useSelector((state: { promptsReducer: { prompts: { prompt: string }[] } }) => state.promptsReducer.prompts)
  const list = prompts ?? []
  const { ref, unseenCount, scrollToFollow, isHighlighted } = useScrollLock(list, 'top')

  return (
    <div className="list-wrap">
      <div className="content-list" ref={ref}>
        {list.length === 0 ? (
          <div className="prompt-empty">
            <div className="prompt-empty-title">No AI Assist results yet</div>
            <div className="prompt-empty-text">Use the Suggest button above to trigger AI Assist.</div>
          </div>
        ) : null}
        {list.map((entry, index) => (
          <PromptItem e={entry} key={index} highlighted={isHighlighted(index)} />
        ))}
      </div>
      <NewMessagesIndicator count={unseenCount} mode="top" onClick={scrollToFollow} />
    </div>
  )
}

function PromptItem({ e, highlighted }: { e: { prompt: string }; highlighted?: boolean }) {
  const formattedPrompt = formatAiAssistContent(e.prompt)

  if (!formattedPrompt) {
    return null
  }

  return (
    <div className={`prompt-card${highlighted ? ' highlight-new' : ''}`}>
      <div className="transcription-text prompt-card-body">{parse(formattedPrompt)}</div>
    </div>
  )
}

function DataInfoList({
  items,
  onChange,
  onFocus,
  onBlur,
  onCopy
}: {
  items: DataInfoField[]
  onChange: (id: string, newValue: string) => void
  onFocus: (id: string) => void
  onBlur: (id: string) => void
  onCopy: (value: string) => void
}) {
  const { ref, unseenCount, scrollToFollow } = useScrollLock(items, 'top')

  if (items.length === 0) {
    return (
      <div className="list-wrap">
        <div className="content-list" ref={ref}>
          <div className="data-info-empty">
            <div className="data-info-empty-title">No data yet</div>
            <div className="data-info-empty-text">Latest backend data will appear here.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="list-wrap">
      <div className="content-list" ref={ref}>
        <div className="data-info-card">
          <div className="data-info-fields">
            {items.map((item) => (
              <DataInfoFieldItem
                key={item.id}
                item={item}
                onChange={onChange}
                onFocus={onFocus}
                onBlur={onBlur}
                onCopy={onCopy}
              />
            ))}
          </div>
        </div>
      </div>
      <NewMessagesIndicator count={unseenCount} mode="top" onClick={scrollToFollow} />
    </div>
  )
}

function DataInfoFieldItem({
  item,
  onChange,
  onFocus,
  onBlur,
  onCopy
}: {
  item: DataInfoField
  onChange: (id: string, newValue: string) => void
  onFocus: (id: string) => void
  onBlur: (id: string) => void
  onCopy: (value: string) => void
}) {
  const isEditable = item.is_editable === true || item.is_editable === 'true'
  const isCopyable = item.is_copyable === true || item.is_copyable === 'true'

  return (
    <div className="data-info-field-row">
      <label className="data-info-field-label">{item.label}</label>
      <div className="data-info-field-control">
        {item.type === 'option' ? (
          <select
            value={item.value ?? ''}
            onChange={(e) => onChange(item.id, e.target.value)}
            onFocus={() => onFocus(item.id)}
            onBlur={() => onBlur(item.id)}
            disabled={!isEditable}
            className="data-info-select"
          >
            <option value="" disabled>Select...</option>
            {item.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : item.type === 'textarea' ? (
          <textarea
            value={item.value ?? ''}
            onChange={(e) => onChange(item.id, e.target.value)}
            onFocus={() => onFocus(item.id)}
            onBlur={() => onBlur(item.id)}
            readOnly={!isEditable}
            className="data-info-textarea"
            rows={3}
          />
        ) : (
          <input
            type="text"
            value={item.value ?? ''}
            onChange={(e) => onChange(item.id, e.target.value)}
            onFocus={() => onFocus(item.id)}
            onBlur={() => onBlur(item.id)}
            readOnly={!isEditable}
            className="data-info-input"
          />
        )}
        {isCopyable && (
          <button
            type="button"
            className="btn-icon"
            onClick={() => onCopy(item.value ?? '')}
            title="Copy"
          >
            <Copy size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function UploadsTab({ sdkState }: { sdkState: { meetings: { id: string; title: string; status: string; uploadPercentage?: number }[] } }) {
  const [selectedMeeting, setSelectedMeeting] = useState<{ id: string } | null>(null)
  const meetings = sdkState.meetings || []
  const { ref: scrollRef, unseenCount, scrollToFollow, isHighlighted } = useScrollLock(meetings, 'top')

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
    <div className="list-wrap">
      <div className="content-list" ref={scrollRef}>
        {meetings.map((meeting, i) => (
          <div
            key={meeting.id}
            className={`transcription-card${isHighlighted(i) ? ' highlight-new' : ''}`}
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
      <NewMessagesIndicator count={unseenCount} mode="top" onClick={scrollToFollow} />
    </div>
  )
}

function SettingsTab({
  transparency,
  setTransparency,
  currentUser,
  openExternal,
  onLogout
}: {
  transparency: number
  setTransparency: (v: number) => void
  currentUser: { userid?: string; id?: string; name?: string; email?: string; role?: string } | null
  openExternal: (url: string) => void
  onLogout: () => void
}) {
  const { wsUrlDraft, updateWsUrlDraft, commitWsUrlDraft } = useServerUrl()
  const [language, setLanguage] = useState('english')
  const [serverUrlSaveMsg, setServerUrlSaveMsg] = useState<string | null>(null)

  const displayUserId = currentUser?.userid ?? currentUser?.id ?? 'N/A'
  const displayName = currentUser?.name ?? 'N/A'
  const displayEmail = currentUser?.email ?? 'N/A'
  const displayRole = currentUser?.role ?? 'N/A'

  return (
    <div className="content-list settings-tab">
      <div className="setting-section">
        <div className="setting-header">Profile</div>
        <div className="setting-row">
          <span className="setting-label">Name</span>
          <span className="setting-value">{displayName}</span>
        </div>
        <div className="setting-row">
          <span className="setting-label">Email</span>
          <span className="setting-value">{displayEmail}</span>
        </div>
        <div className="setting-row">
          <span className="setting-label">User ID</span>
          <span className="setting-value">{displayUserId}</span>
        </div>
        <div className="setting-row">
          <span className="setting-label">Role</span>
          <span className="setting-value" style={{ color: 'var(--accent)' }}>{displayRole}</span>
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
        <div className="setting-header">Server</div>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <span className="setting-label">WebSocket URL</span>
          <input
            type="text"
            className="setting-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={wsUrlDraft}
            onChange={(e) => updateWsUrlDraft(e.target.value)}
            placeholder="https://….ngrok-free.app or wss://host/ws"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <span className="setting-label" style={{ fontSize: 10, lineHeight: 1.4, textTransform: 'none', fontWeight: 500 }}>
            Paste an ngrok HTTPS link or a full ws:// or wss:// URL. Path defaults to /ws when omitted. Click Save to reconnect.
          </span>
          {serverUrlSaveMsg ? (
            <span className="setting-value" style={{ fontSize: 12, color: 'var(--accent)' }}>{serverUrlSaveMsg}</span>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 'none', width: '100%', height: 40, marginTop: 4 }}
            onClick={() => {
              commitWsUrlDraft()
              setServerUrlSaveMsg('Saved. Reconnecting to the new server…')
              window.setTimeout(() => setServerUrlSaveMsg(null), 3200)
            }}
          >
            Save server URL
          </button>
        </div>
      </div>

      <div className="setting-section">
        <div className="setting-header">About</div>
        <div className="setting-row">
          <span className="setting-label">App Version</span>
          <span className="setting-value">1.0.2</span>
        </div>
        <div className="setting-row" style={{ marginTop: 8 }}>
          <span className="link-btn" onClick={() => openExternal('https://vitt-health-insurance.netlify.app/reset-password')}>
            Change Password
          </span>
        </div>
      </div>

      <button type="button" className="logout-btn" onClick={onLogout}>
        <LogOut size={16} />
        Logout
      </button>
    </div>
  )
}

function ChatWithAITab({
  userid,
  sessionid,
  source
}: {
  userid: string
  sessionid: string
  source?: string
}) {
  const dispatch = useDispatch()
  const { wsRef } = (useData() as unknown) as { wsRef: React.MutableRefObject<WebSocket | null> }
  const messages = useSelector((state: { chatWithAIReducer: { messages: ChatMessage[] } }) => state.chatWithAIReducer.messages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { ref: scrollRef, unseenCount, scrollToFollow, isHighlighted } = useScrollLock(messages, 'bottom')

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !sending) return
    const dist = el.scrollHeight - el.clientHeight - el.scrollTop
    if (dist <= SCROLL_LOCK_THRESHOLD) el.scrollTop = el.scrollHeight
  }, [sending, scrollRef])

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
          source,
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
      <div className="chat-messages-wrap" style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="chat-messages" ref={scrollRef}>
          {messages.map((msg, i) => {
            const fromEnd = messages.length - 1 - i
            const hl = isHighlighted(fromEnd) ? ' highlight-new' : ''
            return msg.role === 'user' ? (
              <div key={msg.id} className={`chat-message-out${hl}`}>
                {msg.content}
              </div>
            ) : (
              <div key={msg.id} className={`chat-message-in${hl}`}>
                <div className="chat-html-content">{ReactHtmlParser(msg.content)}</div>
              </div>
            )
          })}
          {sending && (
            <div className="chat-loading">
              <Loader2 size={20} className="chat-loading-spinner" />
              <span>Waiting for response...</span>
            </div>
          )}
        </div>
        <NewMessagesIndicator count={unseenCount} mode="bottom" onClick={scrollToFollow} />
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

export default function App() {
  const recallElectronAPI = (window as unknown as { electronAPI?: { ipcRenderer: { on: (c: string, h: (s: unknown) => void) => void; send: (c: string, p: unknown) => void; removeAllListeners: (c: string) => void } } }).electronAPI?.ipcRenderer
  const { wsUrl } = useServerUrl()
  const [selectedTab, setSelectedTab] = useState('transcript')
  const [theme, setTheme] = useState('transparent')
  const [transparency, setTransparency] = useState(85)
  const [currentTime, setCurrentTime] = useState('')
  const [isServerConnected, setIsServerConnected] = useState(false)
  const [dataInfoItems, setDataInfoItems] = useState<DataInfoField[]>([])
  const [sdkState, setSdkState] = useState({
    recording: false,
    permissions_granted: true,
    meetings: [] as { id: string; title: string; status: string; uploadPercentage?: number }[]
  })

  const { currentUser, setCurrentUser, setaccess_token } = (useAuth() as unknown) as { currentUser: { userid?: string; id?: string; sessionuid?: string; name?: string; email?: string; role?: string;source?:string} | null; setCurrentUser: (v: null) => void; setaccess_token: (v: string) => void }
  const { wsRef } = (useData() as unknown) as { wsRef: React.MutableRefObject<WebSocket | null> }
  const currentUserRef = useRef(currentUser)
  const fallbackSessionIdRef = useRef(uuidv4())
  const meetingSessionIdsRef = useRef<Record<string, string>>({})
  const sessionuidRef = useRef(fallbackSessionIdRef.current)
  const [activeSessionId, setActiveSessionId] = useState(fallbackSessionIdRef.current)

  const focusedFieldIdRef = useRef<string | null>(null)
  const lastSentDataRef = useRef<string>('')
  const pendingSendRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDataInfoChange = useCallback((id: string, newValue: string) => {
    setDataInfoItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, value: newValue } : item
      )

      if (pendingSendRef.current) {
        clearTimeout(pendingSendRef.current)
      }

      pendingSendRef.current = setTimeout(() => {
        const currentDataStr = JSON.stringify(updated)
        if (currentDataStr !== lastSentDataRef.current) {
          const ws = (wsRef as React.MutableRefObject<WebSocket | null>).current
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'data-info-update-req',
                source: currentUserRef.current?.source ?? '',
                userid: currentUserRef.current?.userid ?? currentUserRef.current?.id ?? '',
                sessionid: sessionuidRef.current ?? '',
                data_info: updated,
                timestamp: getTimeStamp()
              })
            )
            lastSentDataRef.current = currentDataStr
          }
        }
      }, 3500)

      return updated
    })
  }, [wsRef])

  const handleDataInfoFocus = useCallback((id: string) => {
    focusedFieldIdRef.current = id
  }, [])

  const handleDataInfoBlur = useCallback((id: string) => {
    if (focusedFieldIdRef.current === id) {
      focusedFieldIdRef.current = null
    }
  }, [])
  const assistantMsgCount = useSelector((state: { chatWithAIReducer: { messages: ChatMessage[] } }) =>
    state.chatWithAIReducer.messages.filter((m) => m.role === 'assistant').length
  )
  const promptsCount = useSelector((state: { promptsReducer: { prompts: { prompt: string }[] } }) =>
    state.promptsReducer.prompts.length
  )
  const prevAssistantMsgCount = useRef(0)
  const prevPromptsCount = useRef(0)
  const prevDataLen = useRef(0)

  const selectedTabRef = useRef(selectedTab)
  const [unreadTabs, setUnreadTabs] = useState<Set<string>>(new Set())
  const [isSuggesting, setIsSuggesting] = useState(false)
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [meetings, setMeetings] = useState<{ id: string; platform: string; url?: string; title?: string }[]>([])
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null)
  const prevMeetingsCountRef = useRef(0)
  const [copyToast, setCopyToast] = useState(false)
  const userid = (currentUser as { userid?: string; id?: string })?.userid ?? (currentUser as { id?: string })?.id ?? ''
  const source = (currentUser as { source?: string })?.source ?? currentUserRef.current?.source ?? ''
  const recordingMeetingId = activeMeetingId ?? meetings[0]?.id ?? null
  const connectionSessionId =
    currentUser?.sessionuid ?? fallbackSessionIdRef.current
  const activeMeetingIdRef = useRef(activeMeetingId)
  const meetingsRef = useRef(meetings)

  useEffect(() => {
    activeMeetingIdRef.current = activeMeetingId
  }, [activeMeetingId])

  useEffect(() => {
    meetingsRef.current = meetings
  }, [meetings])

  const sendClientInit = (ws: WebSocket) => {
    const roomId = activeMeetingIdRef.current ?? meetingsRef.current[0]?.id ?? ''
    ws.send(
      JSON.stringify({
        type: 'client-init',
        message: 'Hello from browser!',
        source: currentUserRef.current?.source ?? '',
        userid: currentUserRef.current?.userid ?? currentUserRef.current?.id ?? '',
        sessionid: currentUserRef.current?.sessionuid ?? fallbackSessionIdRef.current,
        roomId,
        timestamp: getTimeStamp()
      })
    )
  }

  const socketUrl = useMemo(() => {
    try {
      const url = new URL(wsUrl)
      if (source) url.searchParams.set('source', source)
      if (userid) url.searchParams.set('userid', userid)
      if (connectionSessionId) url.searchParams.set('sessionid', connectionSessionId)
      return url.toString()
    } catch {
      return wsUrl
    }
  }, [wsUrl, source, userid, connectionSessionId])

  const effectiveRoomId = activeMeetingId ?? meetings[0]?.id ?? ''

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
  }, [currentUser])

  useEffect(() => {
    const effectiveMeetingId = activeMeetingId ?? meetings[0]?.id ?? null

    if (!effectiveMeetingId) {
      sessionuidRef.current = fallbackSessionIdRef.current
      setActiveSessionId(fallbackSessionIdRef.current)
      return
    }

    const existingMeetingSessionId = meetingSessionIdsRef.current[effectiveMeetingId]
    const nextMeetingSessionId = existingMeetingSessionId ?? uuidv4()

    meetingSessionIdsRef.current[effectiveMeetingId] = nextMeetingSessionId
    sessionuidRef.current = nextMeetingSessionId
    setActiveSessionId(nextMeetingSessionId)
  }, [activeMeetingId, meetings])

  useEffect(() => {
    selectedTabRef.current = selectedTab
  }, [selectedTab])

  useEffect(() => {
    if (assistantMsgCount > prevAssistantMsgCount.current) {
      if (selectedTabRef.current !== 'chat') {
        setUnreadTabs((prev) => { const s = new Set(prev); s.add('chat'); return s })
      }
    }
    prevAssistantMsgCount.current = assistantMsgCount
  }, [assistantMsgCount])

  useEffect(() => {
    if (promptsCount > prevPromptsCount.current) {
      if (selectedTabRef.current !== 'prompts') {
        setUnreadTabs((prev) => { const s = new Set(prev); s.add('prompts'); return s })
      }
    }
    prevPromptsCount.current = promptsCount
  }, [promptsCount])

  useEffect(() => {
    if (dataInfoItems.length > prevDataLen.current) {
      if (selectedTabRef.current !== 'data_info') {
        setUnreadTabs((prev) => { const s = new Set(prev); s.add('data_info'); return s })
      }
    }
    prevDataLen.current = dataInfoItems.length
  }, [dataInfoItems.length])

  useEffect(() => {
    const onResponse = () => {
      if (suggestTimeoutRef.current) {
        clearTimeout(suggestTimeoutRef.current)
        suggestTimeoutRef.current = null
      }
      setIsSuggesting(false)
    }
    window.addEventListener('chat-response-received', onResponse)
    return () => {
      window.removeEventListener('chat-response-received', onResponse)
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
    }
  }, [])

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
    recallElectronAPI.on('detected-meetings', (payload: unknown) => {
      const data = payload as { meetings?: { id: string; platform: string; url?: string; title?: string }[] }
      const nextMeetings = data?.meetings ?? []
      const nextIds = new Set(nextMeetings.map((m) => m.id))
      Object.keys(meetingSessionIdsRef.current).forEach((id) => {
        if (!nextIds.has(id)) delete meetingSessionIdsRef.current[id]
      })
      setMeetings(nextMeetings)
    })
    recallElectronAPI.send('message-from-renderer', { command: 'renderer-ready' })
    return () => {
      recallElectronAPI.removeAllListeners('state')
      recallElectronAPI.removeAllListeners('detected-meetings')
    }
  }, [])

  useEffect(() => {
    const prevCount = prevMeetingsCountRef.current
    const nextCount = meetings.length

    if (nextCount === 0) {
      setActiveMeetingId(null)
    } else if (nextCount === 1) {
      if (prevCount === 0 || prevCount > 1) {
        setActiveMeetingId(meetings[0].id)
      }
    } else if (nextCount > 1) {
      if (nextCount > prevCount) {
        setActiveMeetingId(null)
      } else {
        setActiveMeetingId((prev) =>
          prev != null && meetings.some((m) => m.id === prev) ? prev : null
        )
      }
    }

    prevMeetingsCountRef.current = nextCount
  }, [meetings])

  useEffect(() => {
    if (activeMeetingId && !meetings.some((m) => m.id === activeMeetingId)) {
      setActiveMeetingId(null)
    }
  }, [activeMeetingId, meetings])

  const dispatch = useDispatch()
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
  const wsReconnectRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const ref = wsRef as React.MutableRefObject<WebSocket | null>
    const reconnectInterval = 1000
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    const clearReconnect = () => {
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const teardownWs = () => {
      clearReconnect()
      const w = appSharedWs
      if (w) {
        w.onopen = null
        w.onmessage = null
        w.onclose = null
        w.onerror = null
        try {
          w.close()
        } catch {
          /* ignore */
        }
      }
      appSharedWs = null
      ref.current = null
    }

    const connect = () => {
      if (disposed) return
      teardownWs()

      const tempWs = new WebSocket(socketUrl)
      appSharedWs = tempWs
      ref.current = tempWs

      tempWs.onopen = () => {
        if (disposed) return
        setIsServerConnected(true)
        sendClientInit(tempWs)
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
          if (rawDataInfo !== undefined) {
            let nextDataInfoItems: DataInfoField[] = []
            if (Array.isArray(rawDataInfo)) {
              nextDataInfoItems = rawDataInfo as DataInfoField[]
            } else if (typeof rawDataInfo === 'object' && rawDataInfo != null) {
              nextDataInfoItems = [rawDataInfo as DataInfoField]
            }

            if (nextDataInfoItems.length > 0) {
              setDataInfoItems((prev) => {
                const focusedId = focusedFieldIdRef.current;
                const merged = nextDataInfoItems.map((incomingItem) => {
                  if (focusedId && incomingItem.id === focusedId) {
                    const existing = prev.find(p => p.id === focusedId);
                    return existing ? { ...incomingItem, value: existing.value } : incomingItem;
                  }
                  return incomingItem;
                });
                lastSentDataRef.current = JSON.stringify(merged);
                return merged;
              })
            }
          }

          if (isChatWithAiResponseEvent(result, nestedData)) {
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
        if (disposed) return
        reconnectTimer = setTimeout(connect, reconnectInterval)
      }

      tempWs.onerror = () => {
        setIsServerConnected(false)
      }
    }

    wsReconnectRef.current = () => {
      clearReconnect()
      setIsServerConnected(false)
      connect()
    }

    connect()

    return () => {
      disposed = true
      wsReconnectRef.current = null
      teardownWs()
    }
  }, [socketUrl, wsRef])

  useEffect(() => {
    const ws = (wsRef as React.MutableRefObject<WebSocket | null>).current
    if (ws?.readyState !== WebSocket.OPEN) return

    ws.send(
      JSON.stringify({
        type: 'room-update',
        source: currentUserRef.current?.source ?? '',
        userid: currentUserRef.current?.userid ?? currentUserRef.current?.id ?? '',
        sessionid: sessionuidRef.current ?? '',
        roomId: effectiveRoomId,
        timestamp: getTimeStamp()
      })
    )
  }, [effectiveRoomId, wsRef])

  useEffect(() => {
    const overlay = (window as unknown as {
      overlay?: { getRecallBuffer?: (cb: (d: unknown) => void) => (() => void) | void }
    }).overlay
    if (!overlay?.getRecallBuffer) return

    const unsubBuffer = overlay.getRecallBuffer((data: unknown) => {
      const ws = (wsRef as React.MutableRefObject<WebSocket | null>).current
      if (ws?.readyState !== WebSocket.OPEN) return
      ws.send(
        JSON.stringify({
          type: 'recall-buffer',
          source: (currentUserRef.current as { source?: string })?.source ?? '',
          userid:
            (currentUserRef.current as { userid?: string; id?: string })?.userid ??
            (currentUserRef.current as { id?: string })?.id,
          sessionid: sessionuidRef.current,
          data,
          timestamp: getTimeStamp()
        })
      )
    })

    return () => {
      if (typeof unsubBuffer === 'function') unsubBuffer()
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

  const handleTabSelect = (tab: string) => {
    setSelectedTab(tab)
    setUnreadTabs((prev) => { const s = new Set(prev); s.delete(tab); return s })
  }

  const sessionid = activeSessionId

  const resetSessionState = useCallback(() => {
    dispatch(clearTranscriptions())
    dispatch(clearPrompts())
    dispatch(clearChat())

    if (pendingSendRef.current) {
      clearTimeout(pendingSendRef.current)
      pendingSendRef.current = null
    }

    if (suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current)
      suggestTimeoutRef.current = null
    }

    const ws = appSharedWs ?? (wsRef as React.MutableRefObject<WebSocket | null>).current
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      appSharedWs = null
      wsRef.current = null
    }

    const nextFallbackSessionId = uuidv4()
    fallbackSessionIdRef.current = nextFallbackSessionId
    meetingSessionIdsRef.current = {}
    sessionuidRef.current = nextFallbackSessionId
    currentUserRef.current = null
    focusedFieldIdRef.current = null
    lastSentDataRef.current = ''
    selectedTabRef.current = 'transcript'
    prevAssistantMsgCount.current = 0
    prevPromptsCount.current = 0
    prevDataLen.current = 0

    setActiveSessionId(nextFallbackSessionId)
    setSelectedTab('transcript')
    setUnreadTabs(new Set())
    setIsSuggesting(false)
    setCopyToast(false)
    setDataInfoItems([])
    setIsServerConnected(false)
    setMeetings([])
    setActiveMeetingId(null)
    setSdkState({
      recording: false,
      permissions_granted: true,
      meetings: []
    })
  }, [dispatch, wsRef])

  useEffect(() => {
    if (!currentUser?.sessionuid) return
    sessionuidRef.current = currentUser.sessionuid
    fallbackSessionIdRef.current = currentUser.sessionuid
    setActiveSessionId(currentUser.sessionuid)
  }, [currentUser?.sessionuid])

  const handleLogout = () => {
    resetSessionState()
    setCurrentUser(null)
    setaccess_token('')
  }

  const copyToClipboard = (value?: string) => {
    if (!value) return
    try {
      navigator.clipboard.writeText(value)
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 1500)
    } catch (e) {
      console.error('copy failed', e)
    }
  }

  const triggerRefresh = () => {
    dispatch(clearTranscriptions())
    dispatch(clearPrompts())
    dispatch(clearChat())

    if (pendingSendRef.current) {
      clearTimeout(pendingSendRef.current)
      pendingSendRef.current = null
    }

    if (suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current)
      suggestTimeoutRef.current = null
    }

    focusedFieldIdRef.current = null
    lastSentDataRef.current = ''
    prevAssistantMsgCount.current = 0
    prevPromptsCount.current = 0
    prevDataLen.current = 0

    setDataInfoItems([])
    setUnreadTabs(new Set())
    setIsSuggesting(false)
    setIsServerConnected(false)

    wsReconnectRef.current?.()
  }

  const triggerSuggest = () => {
    if (isSuggesting) return
    const ws = (wsRef as React.MutableRefObject<WebSocket | null>).current
    if (ws?.readyState !== WebSocket.OPEN) return
    setIsSuggesting(true)
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
    suggestTimeoutRef.current = setTimeout(() => {
      suggestTimeoutRef.current = null
      setIsSuggesting(false)
    }, CHAT_RESPONSE_TIMEOUT_MS)
    ws.send(JSON.stringify({
      type:'generate-filler',
      source,
      userid, sessionid,
    }))
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
            <button type="button" className={`btn-icon ${selectedTab === 'settings' ? 'active' : ''}`} onClick={() => handleTabSelect('settings')} title="Settings">
              <Settings size={18} />
            </button>
            <button type="button" className="btn-icon" onClick={minimizeApp} title="Minimize">
              <Minus size={18} />
            </button>
            <WindowResizeButton />
            <button type="button" className="btn-icon danger" onClick={closeApp} title="Quit">
              <X size={18} />
            </button>
          </div>
        </div>

        {(() => {
          if (activeMeetingId) {
            const meeting = meetings.find((m) => m.id === activeMeetingId)
            if (!meeting) return null
            const icon = getMeetingPlatformIcon(meeting.platform)
            const name = getMeetingPlatformLabel(meeting.platform)
            return (
              <div className="status-section no-drag" style={{ padding: '0 12px 8px' }}>
                <div className="meeting-card no-drag">
                  <div className="meeting-card-close" onClick={() => setActiveMeetingId(null)}>
                    <X size={12} />
                  </div>
                  <div className="meeting-info">
                    <div className="meeting-icon">
                      {icon ? <img src={icon} alt={name} /> : null}
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
              </div>
            )
          }
          if (meetings.length > 0) {
            return (
              <div className="status-section no-drag" style={{ padding: '0 12px 8px' }}>
                <div className="meeting-list no-drag">
                  {meetings.length > 1 ? <span className="meeting-list-label">Meetings:</span> : null}
                  {meetings.map((m) => {
                    const icon = getMeetingPlatformIcon(m.platform)
                    return (
                      <div
                        key={m.id}
                        className="meeting-list-item"
                        onClick={() => setActiveMeetingId(m.id)}
                        title={`Open ${getMeetingPlatformLabel(m.platform)}`}
                      >
                        {icon ? <img src={icon} alt={m.platform} /> : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }
          return null
        })()}

        <div className="no-drag" style={{ padding: '0 12px 6px', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>{currentTime}</div>
            <div style={{ color: isServerConnected ? '#22c55e' : '#ef4444' }}>
              {isServerConnected ? 'Server Connected' : 'Server Disconnected'}
            </div>
          </div>
          <div className="prompt-actions">
            <button type="button" className="prompt-trigger-btn prompt-trigger-btn-secondary" onClick={triggerRefresh}>
              <RefreshCw size={13} style={{ marginRight: 4 }} />
              Refresh
            </button>
            <button type="button" className="prompt-trigger-btn" onClick={triggerSuggest} disabled={isSuggesting}>
              <Sparkles size={13} style={{ marginRight: 4 }} />
              {isSuggesting ? 'Thinking...' : 'Suggest'}
            </button>
          </div>
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
                  onClick={() =>
                    recallElectronAPI?.send('message-from-renderer', {
                      command: 'start-recording',
                      id: recordingMeetingId
                    })
                  }
                >
                  <Mic size={18} />
                  {sdkState.recording ? 'Recording...' : 'Start Recording'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!sdkState.recording}
                  onClick={() =>
                    recallElectronAPI?.send('message-from-renderer', {
                      command: 'stop-recording',
                      id: recordingMeetingId
                    })
                  }
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
          {selectedTab === 'chat' && <ChatWithAITab userid={userid} sessionid={sessionid} source={source} />}
          {selectedTab === 'prompts' && <PromptList />}
          {selectedTab === 'data_info' && (
            <DataInfoList
              items={dataInfoItems}
              onChange={handleDataInfoChange}
              onFocus={handleDataInfoFocus}
              onBlur={handleDataInfoBlur}
              onCopy={copyToClipboard}
            />
          )}
          {selectedTab === 'settings' && (
            <SettingsTab
              transparency={transparency}
              setTransparency={setTransparency}
              currentUser={currentUser}
              openExternal={openExternal}
              onLogout={handleLogout}
            />
          )}
        </div>

        <div className="tab-bar no-drag" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <TabButton active={selectedTab === 'transcript'} onClick={() => handleTabSelect('transcript')} icon={<FileText size={18} />} label="Transcript" />
          {/* <TabButton active={selectedTab === 'uploads'} onClick={() => handleTabSelect('uploads')} icon={<Cloud size={18} />} label="Uploads" /> */}
          <TabButton active={selectedTab === 'chat'} onClick={() => handleTabSelect('chat')} icon={<BotMessageSquare size={18} />} label="AI Chat" hasUnread={unreadTabs.has('chat')} />
          <TabButton active={selectedTab === 'prompts'} onClick={() => handleTabSelect('prompts')} icon={<Sparkles size={18} />} label="AI Assist" hasUnread={unreadTabs.has('prompts')} />
          <TabButton active={selectedTab === 'data_info'} onClick={() => handleTabSelect('data_info')} icon={<Database size={18} />} label="Data" hasUnread={unreadTabs.has('data_info')} />
        </div>

        <div className="toast-container">
          <div className={`toast ${copyToast ? 'visible' : ''}`}>Copied to clipboard</div>
        </div>

        <div className="bottom-hint no-drag">
          To Toggle use alt + shift + h
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  hasUnread = false
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  hasUnread?: boolean
}) {
  return (
    <button type="button" className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="tab-icon-wrap">
        {icon}
        {hasUnread && !active && <span className="tab-unread-dot" />}
      </span>
      <span className="tab-label">{label}</span>
    </button>
  )
}
