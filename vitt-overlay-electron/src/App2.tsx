import React,{ useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import './App.css'
import './App2.css'
import { addTranscription } from './redux/reducers/TranscriptionReducer'
import { Power } from "lucide-react";
import parse from 'html-react-parser';
import {
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Pause,
  Mic,
  Copy,
  SunMoon,
  SunMedium,
  Link2
} from 'lucide-react';
import { useData } from './context/DataWrapper'
import { useVad } from "./context/VadWrapper";
import { useAuth } from './context/AuthContext'
import { getTimeStamp } from './functions/generalFn'
import { addPrompt } from './redux/reducers/promptsReducer'
import GMeetIcon from './assets/g-meet.png'
import ZoomIcon from './assets/zoom.png'
import TeamsIcon from './assets/teams.png'

function TranscriptionList(){
  const transcriptions = useSelector(state=>state.transcriptionReducer.transcriptions)
  return (
    <div>
    {transcriptions.map((e,i)=><Transcription e={e} key={i}/>)}
    </div>
  )
}
function Transcription({ e }) {
  return (
    <div className="transcription-item">
      <div className="item">
        {e.speaker && <div style={{fontSize: 10, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase'}}>{e.speaker}</div>}
        <div className="text">{e.transcription}</div>
      </div>
    </div>
  )
}

function PromptList(){
  const prompts = useSelector(state=>state.promptsReducer.prompts)

  console.log('prompts',prompts)
  return (
    <div>
    {prompts?.map((e)=><SinglePrompt e={e}/>)}
          
    </div>
  )
}

function SinglePrompt({ e }) {
  return (
    <div className="prompt-card-wrap">
      <div className="prompt-card">
        <p className="text">{parse(e.prompt)}</p>
      </div>
    </div>
  )
}

function UploadsTab({sdkState}){
  console.log('uploads sdkState',sdkState)
  const [selectedMeeting, setSelectedMeeting] = React.useState(null);

   const RecordingStatusIcon = ({ status }) => {
  const iconProps = {
    strokeWidth: 2,
    size: 24
  };

  switch (status) {
    case 'completed':
      return <CheckCircle2 {...iconProps} className="status-icon completed" />;
    case 'failed':
      return <AlertCircle {...iconProps} className="status-icon failed" />;
    case 'in-progress':
      return <UploadCloud {...iconProps} className="status-icon in-progress" />;
    case 'paused':
      return <Pause {...iconProps} className="status-icon paused" />;
    default:
      return null;
  }
};

  return (
    <div className="recordings-list">
      {sdkState.meetings.map((meeting) => (
            <div
              key={meeting.id}
              className={`recording-item ${selectedMeeting?.id === meeting.id ? 'selected' : ''}`}
              onClick={() => setSelectedMeeting(meeting)}
              onKeyDown={e => e.key === 'Enter' && setSelectedMeeting(meeting)}
              role="button"
              tabIndex={0}
            >
              <RecordingStatusIcon status={meeting.status} />
              <div className="recording-details">
                <p className="recording-title">{meeting.title}</p>
                <p className="recording-title">{meeting.id}</p>
                <p className="recording-upload-progress">
                  {meeting.uploadPercentage}% Uploaded
                </p>
              </div>
            </div>
          ))}
        </div>
  )
}
function App2() {
   // console.log('App rendered hui');
  const recallElectronAPI = window.electronAPI?.ipcRenderer;
  const wsUrl = 'ws://34.100.145.102/ws'
  //const wsUrl = 'wss://5dedd0a3c090.ngrok-free.app/ws'

  const [selectedTab,setSelectedTab] = useState('transcript') //transcript, prompts, settings
  const [theme,setTheme] = useState('transparent') // dark | transparent
  const [copyToast, setCopyToast] = useState(false)
  const [meetingDetected,setMeetingDetected] = useState({});
  const [sdkState, setSdkState] = React.useState({
    bot_id: null,
    recording: false,
    transcript: null,
    video_url: null,
    permissions_granted: true,
    meetings: [],
  });
  


 const logoutBtn = async () => {
  try {
    console.log("logout btn clicked");

    const res = await axios.post(
      "http://localhost:5000/logout",
      {},
      { withCredentials: true }
    );

    console.log("logout res", res);

    // recallElectronAPI.send("message-from-renderer", {
    //   command: "logout",
    // });

    // better than reload
    window.location.href = "/login";
  } catch (err) {
    console.error("Logout failed", err);
    //alert("Logout nahi hua bhai, thoda ruk ke try kar");
  }
};

  
  const transcriptions = useSelector(state=>state.transcriptionReducer.transcriptions)
  const dispatch = useDispatch()

  const {currentUser,sessionuid} = useAuth()

  const {ws,setWs,wsRef} = useData()
  const wasClosedByUserRef = useRef(false);
  const currentUserRef = useRef(currentUser);
  const sessionuidRef = useRef(sessionuid);
  useEffect(() => {
    currentUserRef.current = currentUser;
    sessionuidRef.current = sessionuid;
  }, [currentUser, sessionuid]);

  React.useEffect(() => {
    if(!recallElectronAPI)
      return ;
    console.log("Setting up IPC listeners...");

    recallElectronAPI.on("state", (newState) => {
      //console.log("=== State received from SDK:", newState);
      setSdkState(newState);
    });

    // Signal that renderer is ready to receive state updates
    recallElectronAPI.send("message-from-renderer", {
      command: "renderer-ready",
    });

    return () => {
      recallElectronAPI.removeAllListeners("state");
    };
  }, []);

  React.useEffect(()=>{
    if(wsRef.current)
      return;
    console.log('setting up ws connection to',wsUrl)

    let tempWs ;
    let reconnectInterval = 1000; // 5 seconds

    function connect(){
       tempWs = new WebSocket(wsUrl);

    tempWs.onopen = (event) => {
      console.log('WebSocket connection opened:', event);


      tempWs.send('Hello from the browser!');

      //setTimeout(())
     // wsRef.current = tempWs;
     // setWs(tempWs) // Send a message to the server
    };

    // Event listener for incoming messages
    tempWs.onmessage = (event) => {
      try {
        const result = JSON.parse(event.data);
        console.log('Message from server:', result);
        if(result.type==='transcript'){
          dispatch(addTranscription(result))
        }
        if(result.type==='llm_response'){
          dispatch(addPrompt(result))
        }
      } catch {
        // Ignore non-JSON messages (e.g. "WS READY")
      }
    };

    // Event listener for errors
    tempWs.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Event listener for when the connection is closed
    tempWs.onclose = (event) => {
      console.log('WebSocket connection closed:', event);
      wsRef.current && wsRef.current.close();
      
      setTimeout(connect, reconnectInterval);
    };

    wsRef.current = tempWs;
    }
    
    connect();

   
    return ()=>{ 
      wsRef.current && wsRef.current.close();
      //tempWs && tempWs.close();
      //setWs(null);
    }
  },[])


  React.useEffect(()=>{
    console.log('transcriptions',transcriptions)
  },[transcriptions])

  React.useEffect(()=>{
    if(!ws) return ;

      let timeOutId = setTimeout(()=>{
        //sendPostReqToServer()
        console.log('ws msg send')
        ws.send('hello world from ws client')
      },5000)

      
      return ()=>clearTimeout(timeOutId)

  },[ws])

  // Single subscription to recall-buffer with cleanup to prevent duplicate audio (repetition/echo/stutter)
  useEffect(() => {
    if (!recallElectronAPI || !window.overlay) return;

    const unsubSomething = window.overlay.somethingHappened((data: unknown) => {
      console.log('data', data);
    });

    const unsubBuffer = window.overlay.getRecallBuffer((data: unknown) => {
      const socket = wsRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        const ob = {
          type: 'recall-buffer',
          userid: currentUserRef.current?.id,
          sessionid: sessionuidRef.current,
          data,
          timestamp: getTimeStamp(),
        };
        socket.send(JSON.stringify(ob));
      }
    });

    const unsubMeetingId = window.overlay.getMeetingId((id: unknown) => {
      const el = document.getElementById('meeting_id');
      if (el) el.innerText = `${id}`;
    });

    const unsubMeetingDetected = window.overlay.meetingDetected((e: { window: unknown }) => {
      console.log('meeting detected in overlay', e);
      setMeetingDetected(e.window);
    });

    return () => {
      if (typeof unsubSomething === 'function') unsubSomething();
      if (typeof unsubBuffer === 'function') unsubBuffer();
      if (typeof unsubMeetingId === 'function') unsubMeetingId();
      if (typeof unsubMeetingDetected === 'function') unsubMeetingDetected();
    };
  }, []);

  //console.log('VAD2', VAD2)

  const closeApp = () => {
    // Call the function exposed in preload.js
    console.log('closeApp called')
    window.overlay.quitApp();
  };

  function renderChildren(){
    if (selectedTab === 'transcript') {
      return <TranscriptionList />
    }else if (selectedTab === 'prompts') {
      return <PromptList/>
    }else if (selectedTab === 'uploads') {
      return <UploadsTab  sdkState={sdkState}/>
    }
    return  <TranscriptionList/>
  }

  // return (
  //   <div>hello world</div>
  // )

  function copyToClipboard(value?: string){
    const text = value != null ? String(value) : (document.getElementById('meeting_id')?.innerText ?? '');
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2000);
      })
      .catch(err => console.error('Could not copy text: ', err));
  }

  function toggleTheme(){
    document.body.style.backgroundColor = theme==='dark' ? 'transparent' : 'black';
    setTheme(p=>p==='dark'?'transparent':'dark');

  }
  function renderMeetingDetected(meeting) {
    if (!meeting || !meeting.platform) return null;
    
    const Card = ({ icon, name }) => (
      <div className="meeting-detected-card">
        <div className="meeting-detected-card__left">
          <div className="meeting-detected-card__icon-wrap">
            <img src={icon} alt="" />
          </div>
          <div>
            <p className="meeting-detected-card__label">Meeting Detected</p>
            <p className="meeting-detected-card__name">{name}</p>
          </div>
        </div>
        <div className="meeting-detected-card__actions">
          <button type="button" className="btn-icon" onClick={() => copyToClipboard(meeting?.id)} title="Copy Meeting ID"><Copy size={16}/></button>
          <button type="button" className="btn-icon" onClick={() => copyToClipboard(meeting?.url)} title="Copy Meeting Link"><Link2 size={16} /></button>
        </div>
      </div>
    );
    switch (meeting.platform) {
      case 'zoom': return <Card icon={ZoomIcon} name="Zoom" />;
      case 'google-meet': return <Card icon={GMeetIcon} name="Google Meet" />;
      case 'teams': return <Card icon={TeamsIcon} name="Teams" />;
      default: return null;
    }
  }

  return (
    <div className="drag-region">
      <div className="card app2-card drag-region" id="card" data-theme={theme}>
        <div className="app-header drag-region">
          <div className="app-title">
            <span className="dot" />
            <span>Vitt Overlay</span>
          </div>
          <div className="app-header-actions no-drag">
            <button type="button" className="btn-icon" title={theme === 'dark' ? 'Switch to transparent' : 'Switch to dark mode'} onClick={toggleTheme}>
              {theme === 'dark' ? <SunMedium strokeWidth={2} color="currentColor" size={20} /> : <SunMoon strokeWidth={2} color="currentColor" size={20} />}
            </button>
            <button type="button" className="btn-icon" title="Notifications">🔔</button>
            <button type="button" className="btn-icon" title="Quit" onClick={closeApp}>❌</button>
            <button type="button" className="btn-icon btn-icon--danger" title="Logout" onClick={logoutBtn}>
              <Power size={18} />
            </button>
          </div>
        </div>

        <section className="status-bar no-drag">
          <div className="status-bar-id">
            <p id="meeting_id" />
            <div className="status-bar__copy" onClick={() => copyToClipboard()} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && copyToClipboard()} aria-label="Copy meeting ID">
              <Copy size={14} />
            </div>
          </div>
          {renderMeetingDetected(meetingDetected)}
        </section>

        <section className="control-panel no-drag">
          {sdkState.permissions_granted ? (
            <div className="recording-controls">
              <button type="button" className={`btn-primary ${sdkState.recording ? 'recording-active' : ''}`} disabled={sdkState.recording} onClick={() => recallElectronAPI.send("message-from-renderer", { command: "start-recording" })}>
                {sdkState.recording ? <div className="dot" style={{width: 8, height: 8, background: 'var(--danger)', borderRadius: '50%'}}/> : <Mic strokeWidth={2} size={18} />}
                {sdkState.recording ? 'Recording...' : 'Start Recording'}
              </button>
              <button type="button" className="btn-icon btn-icon--danger" title="Stop Recording" disabled={!sdkState.recording} onClick={() => recallElectronAPI.send("message-from-renderer", { command: "stop-recording" })}>
                <Pause strokeWidth={2} size={20} />
              </button>
            </div>
          ) : (
            <div className="recording-controls recording-controls--message">Permissions haven&apos;t been granted yet. Please check Settings.</div>
          )}
        </section>

        <div className="list no-drag">
          {renderChildren()}
        </div>

        <div className="tab-bar no-drag">
          <button type="button" className={`tab-btn ${selectedTab === 'transcript' ? 'tab-btn--active' : ''}`} onClick={() => setSelectedTab('transcript')}>
            <span className="t-ic">📝</span>
            <span className="t-txt">Transcript</span>
          </button>
          <button type="button" className={`tab-btn ${selectedTab === 'uploads' ? 'tab-btn--active' : ''}`} onClick={() => setSelectedTab('uploads')}>
            <span className="t-ic">🤖</span>
            <span className="t-txt">Uploads</span>
          </button>
          <button type="button" className="tab-btn">
            <span className="t-ic">🤖</span>
            <span className="t-txt">Chat with AI</span>
          </button>
          <button type="button" className={`tab-btn ${selectedTab === 'prompts' ? 'tab-btn--active' : ''}`} onClick={() => setSelectedTab('prompts')}>
            <span className="t-ic">📊</span>
            <span className="t-txt">Prompts</span>
          </button>
        </div>

        <div className="toast-wrap no-drag">
          <div className={`toast ${copyToast ? 'toast--visible' : ''}`} role="status" aria-live="polite">Copied to clipboard</div>
        </div>
        <div className="app-state no-drag">Click-through: <b id="state">ON</b> • Toggle with <span className="kbd">⌥ + `</span></div>
      </div>
    </div>
  )
}

export default App2
