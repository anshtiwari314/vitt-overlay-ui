import React,{ useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { addTranscription } from './redux/reducers/TranscriptionReducer'
import {CustomFillButton,CustomFillButtonWithIcon} from './components/Buttons'
import { Power,X } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import parse from 'html-react-parser';
import {
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Pause,
  Mic,
  Key,
  RefreshCw,
  Copy,
  SunMoon,
  SunMedium,
  Link2
} from 'lucide-react';
import { useData } from './context/DataWrapper'
import {
  faSearch,
  //faMicrophone,
  faMicrophoneSlash,
  faPlusCircle,
  faTimesCircle,
  faRecordVinyl,
  faMicrophoneAlt,
  faMicrophoneAltSlash,
  faWonSign,
  faShare,
  faTimes,
  faBars,
  faMicrophone
} from "@fortawesome/free-solid-svg-icons";
// import {} from "@fortawesome/free-regular-svg-icons";
import LoadingIcons, { 
  Audio, BallTriangle, Bars, Circles, Grid, Hearts, Oval, 
  Puff, Rings, SpinningCircles, TailSpin, ThreeDots 
} from 'react-loading-icons';

//import FileLoadChecker from '../components/FileLoader'
import { useVad } from "./context/VadWrapper";
import { useAuth } from './context/AuthContext'
import { EntypoMic,EntypoModernMic} from "react-entypo";
import { getTimeStamp } from './functions/generalFn'
import axios from 'axios'
import { addPrompt } from './redux/reducers/promptsReducer'
import GMeetIcon from './assets/g-meet.png'
import ZoomIcon from './assets/zoom.png'
import TeamsIcon from './assets/teams.png'

function TranscriptionList(){
  const transcriptions = useSelector(state=>state.transcriptionReducer.transcriptions)
  return (
    <div>
    {transcriptions.map((e,i)=><Transcription e={e} key={i}/>)}
          {/* <div className="item">
            <div className="left i-indigo">💡</div>
            <div className="text">Suggest showing demo slide.</div>
          </div>
          <div className="item">
            <div className="left i-yellow">⏰</div>
            <div className="text">Remind to discuss pricing options.</div>
          </div>
          <div className="item">
            <div className="left i-red">⚠️</div>
            <div className="text">Ask about decision timeline.</div>
          </div>
          <div className="item">
            <div className="left i-teal">🔗</div>
            <div className="text">Link fast onboarding → faster RSOI.</div>
          </div>
          <div className="item">
            <div className="left i-gray">📄</div>
            <div className="text">Security Whitepaper.pdf</div>
          </div> */}
    </div>
  )
}
function Transcription({e}){

  //console.log('e',e)
  return (
    <div style={{display:'flex',justifyContent: 'flex-start',margin:'0.5rem 0'}}>
        <div className="item" style={{marginRight:'0.5rem',
         // backgroundColor:e.speaker==='agent'? 'orange':'blue'
          }}>
            <div className="left i-green">★</div>
            <div className="text">{e.transcription}</div>
            <div>{e.speaker}</div>
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

function SinglePrompt({e}){
  return (
    <div style={{display:'flex',justifyContent:'flex-start',margin:'0.5rem 0'}}>
        <div className="w-full" style={{marginRight:'0.5rem',
         // backgroundColor:e.speaker==='agent'? 'orange':'blue'
         //width:'510px'
         backgroundColor:'rgba(255,255,255,0.1)',padding:'0.8rem 1rem',borderRadius:'0.5rem'
          }}>
            {/* <div className="left i-green">★</div> */}
            <p className="text w-full" style={{width:'', textWrap:'wrap'}}>{parse(e.prompt)}</p>
            {/* <div>{e.speaker}</div> */}
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
              style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem'}}
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
function App() {
   // console.log('App rendered hui');
  const recallElectronAPI = window.electronAPI?.ipcRenderer;
  //const wsUrl = 'ws://34.100.145.102/ws'
  const wsUrl = 'wss://b6ff8fd3aac1.ngrok-free.app/ws'

  const [count, setCount] = useState(0)
  const [selectedTab,setSelectedTab] = useState('transcript') //transcript, prompts, settings
  const [theme,setTheme] = useState('transparent') //dark, transparent;
  const [meetingDetected,setMeetingDetected] = useState({});
  const {authServerUrl} = useData();
  
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
      `${authServerUrl}/logout`,
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

  const {manualVadStatus,setManualVadStatus,vadRecordingOn,
    setVadRecordingOn,vadStatus,setVadStatus,vadInstance,VAD2,userSpeaking} = useVad()

    const {currentUser,sessionuid} = useAuth()

  const {ws,setWs,wsRef} = useData()
  const wasClosedByUserRef = useRef(false);

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
      return null 
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
      //console.log('tempws',event)
      let result = JSON.parse(event.data);
      //console.log('tempws',result)
      
      console.log('Message from server:', result);
    //  dispatch(addTranscription(result))
      
      if(result.type==='transcript'){
        dispatch(addTranscription(result))
      }
      if(result.type==='llm_response'){
        dispatch(addPrompt(result))
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

  useEffect(()=>{
    if(!recallElectronAPI )
      return ;

    //&& wsRef.current.readyState === WebSocket.OPEN
    if (wsRef.current ) {
   // console.log('overlay object in electron',window.overlay)
    window.overlay.somethingHappened((data)=>{
     
      console.log('data',data)
    })

    window.overlay.getRecallBuffer((data)=>{
     
      console.log('recall-buffer',data)
      let ob = {
        type:'recall-buffer',
        userid:currentUser?.id,
        sessionid:sessionuid,
        data:data,
        timestamp:getTimeStamp()
      }
      // ws.send(ob)
      wsRef.current.send(JSON.stringify(ob))
    })

    window.overlay.getMeetingId((id)=>{
      document.getElementById('meeting_id').innerText = `${id}`
      
    })

    window.overlay.meetingDetected((e)=>{
      console.log('meeting detected in overlay',e)
      setMeetingDetected(e.window)
    })
  }
  },[ws])

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

  function copyToClipboard(){
    const text = document.getElementById('meeting_id')?.innerText;
    navigator.clipboard.writeText(text)
    .then(() => {
      // Success message (optional)
      console.log('Text copied to clipboard');
      alert('Copied the text: ' + text);
    })
    .catch(err => {
      // Error handling
      console.error('Could not copy text: ', err);
    })
  }

  function toggleTheme(){
    document.body.style.backgroundColor = theme==='dark' ? 'transparent' : 'black';
    setTheme(p=>p==='dark'?'transparent':'dark');

  }
const buttonStyle = {
  backgroundColor: '#333',
  border: 'none',
  borderRadius: '6px',
  color: '#eee',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  transition: 'background 0.2s'
};

const meetingDetectedContainerStyle = {
  display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      backgroundColor: '#1e1e1e', // Dark theme card
      borderRadius: '12px',
      border: '1px solid #333',
      width: '100%',
      maxWidth: '450px',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif',
      margin:'0 auto'
}
  function renderMeetingDetected(meeting){
    switch(meeting?.platform){
      case 'zoom':
        return (
          <div style={meetingDetectedContainerStyle}>
      {/* Left Section: Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '8px',
          borderRadius: '8px',
          display: 'flex'
        }}>
          <img src={ZoomIcon} alt="GMeet" style={{ width: '40px', height: '24px' }}/>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#aaa', fontWeight: '500' }}>Meeting Detected</p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Zoom</p>
        </div>
      </div>

      {/* Right Section: Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => copyToClipboard(meeting?.id)}
          style={buttonStyle}
          title="Copy Meeting ID"
        >
          ID
        </button>
        <button 
          onClick={() => copyToClipboard(meeting?.url)}
          style={{ ...buttonStyle, color: '#d51a1a' }}
          title="Copy Meeting Link"
        >
          <Link2 size={18} />
        </button>
      </div>
    </div>
        )
      case 'google-meet':
        return (
          <div style={meetingDetectedContainerStyle}>
      {/* Left Section: Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '8px',
          borderRadius: '8px',
          display: 'flex'
        }}>
          <img src={GMeetIcon} alt="GMeet" style={{ width: '40px', height: '24px' }}/>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#aaa', fontWeight: '500' }}>Meeting Detected</p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Google Meet</p>
        </div>
      </div>

      {/* Right Section: Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => copyToClipboard(meeting?.id)}
          style={buttonStyle}
          title="Copy Meeting ID"
        >
          ID
        </button>
        <button 
          onClick={() => copyToClipboard(meeting?.url)}
          style={{ ...buttonStyle, color: '#d51a1a' }}
          title="Copy Meeting Link"
        >
          <Link2 size={18} />
        </button>
      </div>
    </div>
            )
      case 'teams':
        return (
          <div style={meetingDetectedContainerStyle}>
      {/* Left Section: Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          padding: '8px',
          borderRadius: '8px',
          display: 'flex'
        }}>
          <img src={TeamsIcon} alt="GMeet" style={{ width: '40px', height: '24px' }}/>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#aaa', fontWeight: '500' }}>Meeting Detected</p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Teams</p>
        </div>
      </div>

      {/* Right Section: Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => copyToClipboard(meeting?.id)}
          style={buttonStyle}
          title="Copy Meeting ID"
        >
          ID
        </button>
        <button 
          onClick={() => copyToClipboard(meeting?.url)}
          style={{ ...buttonStyle, color: '#d51a1a' }}
          title="Copy Meeting Link"
        >
          <Link2 size={18} />
        </button>
      </div>
    </div>
            )
      default:
        return null;
    }
  }

  return (
    <div className='drag-region'>
      <div className="card drag-region" id="card" >
        <div className="card-header drag-region">
          <div className="title">
            <span className="dot"></span>
            <span>Vitt Overlay</span>
          </div>
      <div className="header-actions no-drag flex items-center gap-2">
        <button className="p-2 rounded-full hover:bg-neutral-700 transition" title="Settings" onClick={toggleTheme}>
          {
            theme==='dark' ?
            <SunMedium strokeWidth={2} color="white" size={20}/>
            :
            <SunMoon strokeWidth={2} color={"white"} size={20}/>
          }
          {/* <SunMedium strokeWidth={2} color="#f0f0f0" size={20}/>
          <SunMoon strokeWidth={2} color={"#f0f0f0"} size={20}/> */}
        </button>
        <button className="p-2 rounded-full hover:bg-neutral-700 transition" title="Notifications">🔔</button>
        <button className="p-2 rounded-full hover:bg-neutral-700 transition" title="Quit" onClick={closeApp} style={{fontSize:'0.85rem'}}>❌</button>
        <button onClick={logoutBtn} title="Logout" className="p-2 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition">
          <Power size={18} />
        </button>
      </div>

        </div>

         {/* {
          !VAD2.loading ? 
         <CustomFillButtonWithIcon 
          color="#8236f5" 
          text="" 
          icon={faMicrophoneAlt}
          style={{
            backgroundColor: manualVadStatus ? 'red' : 'gray'
          }}
          //className={wasClosedByUserRef.current?"":"hidden"}
          iconComp={<FontAwesomeIcon icon={faMicrophoneAlt} style={{ fontSize: '2rem' }} />} 
          onClick={() => setManualVadStatus((p) => !p)}
        />
        
        : 
        <div style={{}}>
            <TailSpin stroke="red"  strokeOpacity={1} speed={.95} style={{margin:'2rem'}}/>
        </div>
        } */}

      
      <section className="status-bar no-drag" style={{display:'flex',justifyContent:'space-around'}}>
          <p id="meeting_id" style={{fontSize:'0.8rem'}}></p>
          <div onClick={copyToClipboard} ><Copy size={20}/></div>
      </section>
      <section className="status-bar no-drag" style={{display:'flex',justifyContent:'space-around'}}>
          {renderMeetingDetected(meetingDetected)}
      </section>
      <section className="control-panel no-drag">
          {
            sdkState.permissions_granted ?
              <div className="recording-controls" style={{margin:'0 auto',width:'fit-content',display:'flex'}}>
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 backdrop-blur-sm"
                  disabled={sdkState.recording }
                  onClick={() => {
                    console.log('sdk state',sdkState);
                    recallElectronAPI.send("message-from-renderer", {
                      command: "start-recording"
                    });

                   // setCanTryStart(false);

                    // setTimeout(function () {
                    //   if (!sdkState.recording)
                    //     setCanTryStart(true);
                    // }, 5000);
                  }}
                >
                  <Mic strokeWidth={2} size={20} />
                  Start 
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 backdrop-blur-sm"
                  disabled={!sdkState.recording}
                  onClick={() => {
                    recallElectronAPI.send("message-from-renderer", {
                      command: "stop-recording"
                    });
                  }}
                >
                  <Pause strokeWidth={2} size={20} />
                  Pause
                </button>
                  {/* <button
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 backdrop-blur-sm"
                 
                >
                  
                  
                  
                </button> */}

              </div>
            :
            <div className="recording-controls">Permissions haven't been granted yet! Please do so in Settings.</div>
          }
      </section>
        <div className="list no-drag" style={{overflowY:'scroll',scrollBehavior:'smooth',height:'55vh'}}>
          {renderChildren()}
        </div>

        <div className="footer no-drag">
          <button className="tool" onClick={()=>setSelectedTab('transcript')} style={{backgroundColor:selectedTab==='transcript'?'rgba(0,0,0,0.25)':'transparent'}}>
            <div className="t-ic">📝</div>
            <div className="t-txt" 
          //  style={{color:selectedTab==='transcript'?'white':'rgba(0,0,0,0.5)'}}
            >Transcript</div>
          </button>
          <button className="tool"
            onClick={()=>setSelectedTab('uploads')}
            style={{backgroundColor:selectedTab==='uploads'?'rgba(0,0,0,0.25)':'transparent'}}
          >
            <div className="t-ic">🤖</div>
            <div className="t-txt" 
           // style={{color:'rgba(0,0,0,0.5)'}}
            >Uploads</div>
          </button>
          <button className="tool">
            <div className="t-ic">🤖</div>
            <div className="t-txt" 
           // style={{color:'rgba(0,0,0,0.5)'}}
            >Chat with AI</div>
          </button>
          <button className="tool" 
          onClick={()=>setSelectedTab('prompts')} 
          style={{backgroundColor:selectedTab==='prompts'?'rgba(0,0,0,0.25)':'transparent'}}
          >
            <div className="t-ic" >📊</div>
            <div className="t-txt"  
           // style={{color:selectedTab==='prompts'?'white':'rgba(0,0,0,0.5)'}}
            >Prompts</div>
          </button>
          {/* <button className="tool">
            <div className="t-ic">⚙️</div>
            <div className="t-txt">Settings</div>
          </button> */}
        </div>

        <div className="state no-drag">Click-through: <b id="state">ON</b> • Toggle with <span className="kbd">⌥ + `</span></div>
      </div>
    </div>
  )
}

export default App
