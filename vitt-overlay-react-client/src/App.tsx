import React,{ useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { addTranscription } from './redux/reducers/TranscriptionReducer'
import {
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Pause,
  Mic,
  Key,
  RefreshCw
} from 'lucide-react';

function TranscriptionList({e}){

  console.log('e',e)
  return (
    <div className="item" style={{marginRight:'0.5rem'}}>
            <div className="left i-green">★</div>
            <div className="text">{e.transcription}</div>
    </div>
  )
}
function App() {
    
  const recallElectronAPI = window.electronAPI.ipcRenderer;
  const wsUrl = 'ws://34.100.145.102/ws'
  
  const [count, setCount] = useState(0)
  const [sdkState, setSdkState] = React.useState({
    bot_id: null,
    recording: false,
    transcript: null,
    video_url: null,
    permissions_granted: true,
    meetings: [],
  });
  const [ws,setWs] = React.useState(null)
  const transcriptions = useSelector(state=>state.transcriptionReducer.transcriptions)
  const dispatch = useDispatch()

  
  React.useEffect(() => {
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
    const tempWs = new WebSocket(wsUrl);

    tempWs.onopen = (event) => {
      console.log('WebSocket connection opened:', event);
      tempWs.send('Hello from the browser!'); // Send a message to the server
    };

    // Event listener for incoming messages
    tempWs.onmessage = (event) => {
      console.log('tempws',event)
      let result = JSON.parse(event.data);
      console.log('tempws',result)
      
      console.log('Message from server:', result);
      dispatch(addTranscription(result))
    };

    // Event listener for errors
    tempWs.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Event listener for when the connection is closed
    tempWs.onclose = (event) => {
      console.log('WebSocket connection closed:', event);
    };
    setWs(tempWs)

    return ()=> tempWs.close()
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
    console.log('overlay object in electron',window.overlay)
    window.overlay.somethingHappened((data)=>{
     
      console.log('data',data)
    })
  },[])

  return (
    <div>
      <div className="card" id="card">
        <div className="card-header drag-region">
          <div className="title">
            <span className="dot"></span>
            <span>Jarvis Live</span>
          </div>
          <div className="header-actions no-drag">
            <button className="icon-btn" title="Mute / Unmute"><span>🔔</span></button>
            <button className="icon-btn" title="Pause"><span>⏸️</span></button>
          </div>
        </div>

      <section className="control-panel">
          {
            sdkState.permissions_granted ?
              <div className="recording-controls" style={{margin:'0 auto',width:'fit-content',display:'flex',border:'0.1rem solid red'}}>
                <button
                  className="start-recording"
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
                  Start Recording
                </button>
                <button
                  className="stop-recording"
                  disabled={!sdkState.recording}
                  onClick={() => {
                    recallElectronAPI.send("message-from-renderer", {
                      command: "stop-recording"
                    });
                  }}
                >
                  <Pause strokeWidth={2} size={20} />
                  Stop Recording
                </button>
              </div>
            :
            <div className="recording-controls">Permissions haven't been granted yet! Please do so in Settings.</div>
          }
      </section>
        <div className="list" style={{overflowY:'scroll',scrollBehavior:'smooth',height:'65vh'}}>
          {transcriptions.map((e)=><TranscriptionList e={e}/>)}
          <div className="item">
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
          </div>
        </div>

        <div className="footer no-drag">
          <button className="tool">
            <div className="t-ic">📝</div>
            <div className="t-txt">Transcript</div>
          </button>
          <button className="tool">
            <div className="t-ic">🤖</div>
            <div className="t-txt">Chat with AI</div>
          </button>
          <button className="tool">
            <div className="t-ic">📊</div>
            <div className="t-txt">Summary</div>
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
