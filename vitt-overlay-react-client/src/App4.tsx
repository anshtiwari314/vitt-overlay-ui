import React, { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import './App.css'
import './App4.css'
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
  UploadCloud,
  Settings
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

function SettingsTab({ transparency, setTransparency, openExternal }) {
  const [language, setLanguage] = useState('english');

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
            min="50" 
            max="100" 
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
          <span className="link-btn" onClick={() => openExternal('https://vitt-health-insurance.netlify.app/reset-password')}>Change Password</span>
        </div>
      </div>
    </div>
  );
}

// --- Main App Component ---

export default function App4() {
  const recallElectronAPI = window.electronAPI?.ipcRenderer;
  //const wsUrl = 'wss://5dedd0a3c090.ngrok-free.app/ws'
  const wsUrl = 'ws://34.100.145.102/ws'
  const [selectedTab, setSelectedTab] = useState('transcript')
  const [theme, setTheme] = useState('transparent')
  const [transparency, setTransparency] = useState(85); // Default opacity %
  const [copyToast, setCopyToast] = useState(false)
  const [meetingId, setMeetingId] = useState('');
  
  // Meeting Management State
  const [meetings, setMeetings] = useState([]);
  const [activeMeetingId, setActiveMeetingId] = useState(null);

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
      const newMeeting = e.window;
      if (!newMeeting) return;

      setMeetings(prev => {
        // Avoid duplicates
        if (prev.find(m => m.id === newMeeting.id)) return prev;
        const updated = [...prev, newMeeting];
        // If it's the only meeting, show it immediately
        if (updated.length === 1) setActiveMeetingId(newMeeting.id);
        return updated;
      });
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
  const minimizeApp = () => window.overlay.minimizeApp && window.overlay.minimizeApp();
  const openExternal = (url) => window.overlay.openExternal && window.overlay.openExternal(url);
  
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
    document.body.style.backgroundColor = 'transparent'; 
  };

  const openDashboard = () => {
    openExternal('http://vitt-health-insurance.netlify.app/');
  };

  // --- Render Helpers ---
  const getIconForPlatform = (platform) => {
    if (platform === 'zoom') return ZoomIcon;
    if (platform === 'google-meet') return GMeetIcon;
    if (platform === 'teams') return TeamsIcon;
    return null;
  };

  const renderMeetingStatus = () => {
    // 1. If active meeting selected, show card
    if (activeMeetingId) {
      const meeting = meetings.find(m => m.id === activeMeetingId);
      if (!meeting) return null; // Should not happen

      const icon = getIconForPlatform(meeting.platform);
      const name = meeting.platform === 'google-meet' ? 'Google Meet' : meeting.platform?.charAt(0).toUpperCase() + meeting.platform?.slice(1);

      return (
        <div className="meeting-card">
          <div className="meeting-card-close" onClick={() => setActiveMeetingId(null)}><X size={12} /></div>
          <div className="meeting-info">
            <div className="meeting-icon"><img src={icon} alt={name} /></div>
            <div className="meeting-details">
              <span className="meeting-label">Meeting Detected</span>
              <span className="meeting-platform">{name}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon" onClick={() => copyToClipboard(meeting.id)} title="Copy ID"><Copy size={16} /></button>
            <button className="btn-icon" onClick={() => copyToClipboard(meeting.url)} title="Copy Link"><Link2 size={16} /></button>
          </div>
        </div>
      );
    }

    // 2. If multiple meetings (or 1 but closed), show list
    if (meetings.length > 0) {
      return (
        <div className="meeting-list">
          <span className="meeting-list-label">Meetings:</span>
          {meetings.map(m => (
            <div key={m.id} className="meeting-list-item" onClick={() => setActiveMeetingId(m.id)} title={`Open ${m.platform}`}>
              <img src={getIconForPlatform(m.platform)} alt={m.platform} />
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  // --- JSX ---
  return (
    <div className="drag-region">
      <div 
        className="card app4-card drag-region" 
        id="card" 
        data-theme={theme}
        style={{ '--bg-opacity': transparency / 100 }}
      >
        
        {/* Header */}
        <div className="app4-header drag-region">
          <div className="app4-title">
            <span className="dot" />
            <span>Vitt Overlay</span>
          </div>
          <div className="app4-actions no-drag">
            <button className="btn-icon" onClick={openDashboard} title="Dashboard"><LayoutDashboard size={18} /></button>
            <button className="btn-icon" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'dark' ? <SunMedium size={18} /> : <SunMoon size={18} />}
            </button>
            <button className="btn-icon" onClick={minimizeApp} title="Minimize"><Minus size={18} /></button>
            <button className="btn-icon danger" onClick={closeApp} title="Quit"><X size={18} /></button>
          </div>
        </div>

        {/* Status Section (Meeting ID & Detection) */}
        <div className="status-section no-drag">
          {/* Only show ID box if there is a meeting ID (from SDK) */}
          {meetingId && (
            <div className="meeting-id-box">
              <span id="meeting_id" className="meeting-id-text">{meetingId}</span>
              <div className="copy-btn" onClick={() => copyToClipboard(meetingId)}><Copy size={14} /></div>
            </div>
          )}
          {renderMeetingStatus()}
        </div>

        {/* Controls (Only if NOT on Settings tab) */}
        {selectedTab !== 'settings' && (
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
        )}

        {/* List Content / Settings */}
        <div className="list-container no-drag" style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {selectedTab === 'transcript' && <TranscriptionList />}
          {selectedTab === 'prompts' && <PromptList />}
          {/* {selectedTab === 'uploads' && <UploadsTab sdkState={sdkState} />} */}
          {selectedTab === 'settings' && (
            <SettingsTab 
              transparency={transparency} 
              setTransparency={setTransparency} 
              openExternal={openExternal}
            />
          )}
        </div>

        {/* Footer Tabs */}
        <div className="tab-bar no-drag">
          <TabButton 
            active={selectedTab === 'transcript'} 
            onClick={() => setSelectedTab('transcript')} 
            icon="📝" label="Transcript" 
          />
          <TabButton 
            active={selectedTab === 'uploads'} 
            onClick={() => setSelectedTab('uploads')} 
            icon="☁️" label="Uploads" 
          />
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
          <TabButton 
            active={selectedTab === 'settings'} 
            onClick={() => setSelectedTab('settings')} 
            icon="⚙️" label="Settings" 
          />
        </div>

        {/* Toast & Hint */}
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

function TabButton({ active, onClick, icon, label }) {
  return (
    <button className={`tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
    </button>
  )
}
