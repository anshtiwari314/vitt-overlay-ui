import React, { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import './App.css'
import './App3.css'
import { addTranscription } from './redux/reducers/TranscriptionReducer'
import { addPrompt } from './redux/reducers/promptsReducer'
import parse from 'html-react-parser';
import {
  Mic,
  Pause,
  Copy,
  SunMoon,
  SunMedium,
  Link2,
  Minus,
  LayoutDashboard,
  Power,
  X,
  CheckCircle2,
  AlertCircle,
  UploadCloud
} from 'lucide-react';
import { useData } from './context/DataWrapper'
import { useAuth } from './context/AuthContext'
import { getTimeStamp } from './functions/generalFn'
import GMeetIcon from './assets/g-meet.png'
import ZoomIcon from './assets/zoom.png'
import TeamsIcon from './assets/teams.png'

// --- Components ---

function TranscriptionList() {
  const transcriptions = useSelector(state => state.transcriptionReducer.transcriptions)
  return (
    <div className="content-list">
      {transcriptions.map((e, i) => <TranscriptionItem e={e} key={i} />)}
    </div>
  )
}

function TranscriptionItem({ e }) {
  return (
    <div className="transcription-card">
      {e.speaker && <div className="transcription-header">{e.speaker}</div>}
      <div className="transcription-text">{e.transcription}</div>
    </div>
  )
}

function PromptList() {
  const prompts = useSelector(state => state.promptsReducer.prompts)
  return (
    <div className="content-list">
      {prompts?.map((e, i) => <PromptItem e={e} key={i} />)}
    </div>
  )
}

function PromptItem({ e }) {
  return (
    <div className="transcription-card" style={{ background: 'rgba(116, 255, 160, 0.05)', borderColor: 'rgba(116, 255, 160, 0.2)' }}>
      <div className="transcription-text">{parse(e.prompt)}</div>
    </div>
  )
}

function UploadsTab({ sdkState }) {
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const StatusIcon = ({ status }) => {
    const props = { size: 20, strokeWidth: 2 };
    switch (status) {
      case 'completed': return <CheckCircle2 {...props} color="var(--accent)" />;
      case 'failed': return <AlertCircle {...props} color="var(--danger)" />;
      case 'in-progress': return <UploadCloud {...props} color="#60a5fa" />;
      case 'paused': return <Pause {...props} color="var(--text-muted)" />;
      default: return null;
    }
  };

  return (
    <div className="content-list">
      {sdkState.meetings.map((meeting) => (
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
          </div>
          {meeting.uploadPercentage > 0 && meeting.uploadPercentage < 100 && (
            <div style={{ fontSize: 11, color: 'var(--accent)' }}>{meeting.uploadPercentage}%</div>
          )}
        </div>
      ))}
    </div>
  )
}

// --- Main App Component ---

export default function App3() {
  const recallElectronAPI = window.electronAPI?.ipcRenderer;
  //const wsUrl = 'wss://5dedd0a3c090.ngrok-free.app/ws'
  const wsUrl = 'ws://34.100.145.102/ws'
  const [selectedTab, setSelectedTab] = useState('transcript')
  const [theme, setTheme] = useState('transparent')
  const [copyToast, setCopyToast] = useState(false)
  const [meetingDetected, setMeetingDetected] = useState(null);
  const [meetingId, setMeetingId] = useState('');
  const [sdkState, setSdkState] = useState({
    recording: false,
    permissions_granted: true,
    meetings: [],
  });

  const { currentUser, sessionuid } = useAuth()
  const { ws, setWs, wsRef } = useData()
  const currentUserRef = useRef(currentUser);
  const sessionuidRef = useRef(sessionuid);

  useEffect(() => {
    currentUserRef.current = currentUser;
    sessionuidRef.current = sessionuid;
  }, [currentUser, sessionuid]);

  // --- IPC & WebSocket Setup ---
  useEffect(() => {
    if (!recallElectronAPI) return;

    recallElectronAPI.on("state", (newState) => setSdkState(newState));
    recallElectronAPI.send("message-from-renderer", { command: "renderer-ready" });

    return () => recallElectronAPI.removeAllListeners("state");
  }, []);

  useEffect(() => {
    if (wsRef.current) return;
    
    let tempWs;
    let reconnectInterval = 1000;

    function connect() {
      tempWs = new WebSocket(wsUrl);
      tempWs.onopen = () => tempWs.send('Hello from browser!');
      
      tempWs.onmessage = (event) => {
        try {
          const result = JSON.parse(event.data);
          if (result.type === 'transcript') dispatch(addTranscription(result));
          if (result.type === 'llm_response') dispatch(addPrompt(result));
        } catch { /* ignore non-json */ }
      };

      tempWs.onclose = () => {
        wsRef.current?.close();
        setTimeout(connect, reconnectInterval);
      };
      
      wsRef.current = tempWs;
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  // --- Overlay Events ---
  useEffect(() => {
    if (!recallElectronAPI || !window.overlay) return;

    const unsubBuffer = window.overlay.getRecallBuffer((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'recall-buffer',
          userid: currentUserRef.current?.id,
          sessionid: sessionuidRef.current,
          data,
          timestamp: getTimeStamp(),
        }));
      }
    });

    const unsubMeetingId = window.overlay.getMeetingId((id) => {
      setMeetingId(id);
      const el = document.getElementById('meeting_id');
      if (el) el.innerText = id;
    });

    const unsubMeetingDetected = window.overlay.meetingDetected((e) => {
      setMeetingDetected(e.window);
    });

    return () => {
      if (typeof unsubBuffer === 'function') unsubBuffer();
      if (typeof unsubMeetingId === 'function') unsubMeetingId();
      if (typeof unsubMeetingDetected === 'function') unsubMeetingDetected();
    };
  }, []);

  // --- Actions ---
  const dispatch = useDispatch();

  const closeApp = () => window.overlay.quitApp();
  const minimizeApp = () => window.overlay.minimizeApp && window.overlay.minimizeApp(); // Ensure preload exposes this
  
  const logoutBtn = async () => {
    try {
      await axios.post("http://localhost:5000/logout", {}, { withCredentials: true });
      window.location.href = "/login";
    } catch (err) { console.error(err); }
  };

  const copyToClipboard = (text) => {
    const val = text || meetingId;
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    });
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'transparent' : 'dark';
    setTheme(newTheme);
    // Optional: sync body bg if needed, but card handles it via data-theme
    document.body.style.backgroundColor = 'transparent'; 
  };

  const openDashboard = () => {
    window.open('http://vitt-health-insurance.netlify.app/', '_blank');
  };

  // --- Render Helpers ---
  const renderMeetingCard = () => {
    if (!meetingDetected || !meetingDetected.platform) return null;
    
    let icon = null;
    let name = meetingDetected.platform;
    
    if (name === 'zoom') { icon = ZoomIcon; name = 'Zoom'; }
    else if (name === 'google-meet') { icon = GMeetIcon; name = 'Google Meet'; }
    else if (name === 'teams') { icon = TeamsIcon; name = 'Teams'; }

    return (
      <div className="meeting-card">
        <div className="meeting-info">
          <div className="meeting-icon"><img src={icon} alt={name} /></div>
          <div className="meeting-details">
            <span className="meeting-label">Meeting Detected</span>
            <span className="meeting-platform">{name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-icon" onClick={() => copyToClipboard(meetingDetected.id)} title="Copy ID"><Copy size={16} /></button>
          <button className="btn-icon" onClick={() => copyToClipboard(meetingDetected.url)} title="Copy Link"><Link2 size={16} /></button>
        </div>
      </div>
    );
  };

  // --- JSX ---
  return (
    <div className="drag-region">
      <div className="card app3-card drag-region" id="card" data-theme={theme}>
        
        {/* Header */}
        <div className="app3-header drag-region">
          <div className="app3-title">
            <span className="dot" />
            <span>Vitt Overlay</span>
          </div>
          <div className="app3-actions no-drag">
            <button className="btn-icon" onClick={openDashboard} title="Dashboard"><LayoutDashboard size={18} /></button>
            <button className="btn-icon" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'dark' ? <SunMedium size={18} /> : <SunMoon size={18} />}
            </button>
            <button className="btn-icon" onClick={minimizeApp} title="Minimize"><Minus size={18} /></button>
            <button className="btn-icon danger" onClick={closeApp} title="Quit"><X size={18} /></button>
          </div>
        </div>

        {/* Status Section */}
        <div className="status-section no-drag">
          {/* Only show ID box if there is a meeting ID */}
          {meetingId && (
            <div className="meeting-id-box">
              <span id="meeting_id" className="meeting-id-text">{meetingId}</span>
              <div className="copy-btn" onClick={() => copyToClipboard(meetingId)}><Copy size={14} /></div>
            </div>
          )}
          {renderMeetingCard()}
        </div>

        {/* Controls */}
        <div className="controls-section no-drag">
          {sdkState.permissions_granted ? (
            <>
              <button 
                className={`btn-primary ${sdkState.recording ? 'recording' : ''}`}
                disabled={sdkState.recording}
                onClick={() => recallElectronAPI.send("message-from-renderer", { command: "start-recording" })}
              >
                <Mic size={18} />
                {sdkState.recording ? 'Recording...' : 'Start Recording'}
              </button>
              
              <button 
                className="btn-primary"
                disabled={!sdkState.recording}
                onClick={() => recallElectronAPI.send("message-from-renderer", { command: "stop-recording" })}
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

        {/* List Content */}
        <div className="list-container no-drag" style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {selectedTab === 'transcript' && <TranscriptionList />}
          {selectedTab === 'prompts' && <PromptList />}
          {selectedTab === 'uploads' && <UploadsTab sdkState={sdkState} />}
        </div>

        {/* Footer Tabs */}
        <div className="tab-bar no-drag">
          <TabButton 
            active={selectedTab === 'transcript'} 
            onClick={() => setSelectedTab('transcript')} 
            icon="📝" label="Transcript" 
          />
          {/* <TabButton 
            active={selectedTab === 'uploads'} 
            onClick={() => setSelectedTab('uploads')} 
            icon="☁️" label="Uploads" 
          /> */}
          <TabButton 
            active={false} 
            onClick={() => {}} 
            icon="🤖" label="AI Chat" 
          />
          <TabButton 
            active={selectedTab === 'prompts'} 
            onClick={() => setSelectedTab('prompts')} 
            icon="📊" label="Prompts" 
          />
          <button className="tool">
            <div className="t-ic">⚙️</div>
            <div className="t-txt">Settings</div>
          </button>
        </div>

        {/* Toast & Hint */}
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

function TabButton({ active, onClick, icon, label }) {
  return (
    <button className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
    </button>
  )
}
