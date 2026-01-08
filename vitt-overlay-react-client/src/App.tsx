import React,{ useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { addTranscription } from './redux/reducers/TranscriptionReducer'
import {CustomFillButton,CustomFillButtonWithIcon} from './components/Buttons'
import { Power } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import parse from 'html-react-parser';
import {
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Pause,
  Mic,
  Key,
  RefreshCw
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

function TranscriptionList(){
  const transcriptions = useSelector(state=>state.transcriptionReducer.transcriptions)
  return (
    <div>
    {transcriptions.map((e)=><Transcription e={e}/>)}
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
function App() {
    console.log('App rendered hui');
  const recallElectronAPI = window.electronAPI?.ipcRenderer;
  //const wsUrl = 'ws://34.100.145.102/ws'
  const wsUrl = 'wss://f5b0f5d3689a.ngrok-free.app/ws'

  const [count, setCount] = useState(0)
  const [selectedTab,setSelectedTab] = useState('transcript') //transcript, prompts, settings
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
      wsRef.current = tempWs;
      setWs(tempWs) // Send a message to the server
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
      setWs(null);
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
      ws.send(JSON.stringify(ob))
    })
  
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
    }
    return  <TranscriptionList/>
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
              </div>
            :
            <div className="recording-controls">Permissions haven't been granted yet! Please do so in Settings.</div>
          }
      </section>
        <div className="list no-drag" style={{overflowY:'scroll',scrollBehavior:'smooth',height:'55vh',width:'80vw'}}>
          {renderChildren()}
        </div>

        <div className="footer no-drag">
          <button className="tool" onClick={()=>setSelectedTab('transcript')} style={{backgroundColor:selectedTab==='transcript'?'rgba(0,0,0,0.25)':'transparent'}}>
            <div className="t-ic">📝</div>
            <div className="t-txt" 
          //  style={{color:selectedTab==='transcript'?'white':'rgba(0,0,0,0.5)'}}
            >Transcript</div>
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
          <button className="tool">
            <div className="t-ic">⚙️</div>
            <div className="t-txt">Settings</div>
          </button>
        </div>

        <div className="state no-drag">Click-through: <b id="state">ON</b> • Toggle with <span className="kbd">⌥ + `</span></div>
      </div>
    </div>
  )
}

export default App
