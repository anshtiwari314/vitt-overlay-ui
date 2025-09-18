import React,{ useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'


function TranscriptionList({e}){

  return (
    <div className="item" style={{marginRight:'0.5rem'}}>
            <div className="left i-green">★</div>
            <div className="text">{e.transcription}</div>
    </div>
  )
}
function App() {
    let transcriptionData =
  [
  {
    "id": "unique_001",
    "transcription": "I need a health insurance policy.",
    "timeStamp": "15/09/25 14:53:15"
  },
  {
    "id": "unique_002",
    "transcription": "Can you show me some medical insurance plans?",
    "timeStamp": "15/09/25 14:53:48"
  },
  {
    "id": "unique_003",
    "transcription": "Looking for health coverage for my family.",
    "timeStamp": "15/09/25 14:54:02"
  },
  {
    "id": "unique_004",
    "transcription": "What are the best health insurance options?",
    "timeStamp": "15/09/25 14:54:33"
  },
  {
    "id": "unique_005",
    "transcription": "I'm interested in buying a mediclaim policy.",
    "timeStamp": "15/09/25 14:55:01"
  },
  {
    "id": "unique_006",
    "transcription": "How do I get health insurance?",
    "timeStamp": "15/09/25 14:55:25"
  },
  {
    "id": "unique_007",
    "transcription": "Compare health insurance policies.",
    "timeStamp": "15/09/25 14:55:59"
  },
  {
    "id": "unique_008",
    "transcription": "I need a family floater health plan.",
    "timeStamp": "15/09/25 14:56:18"
  },
  {
    "id": "unique_009",
    "transcription": "Searching for health insurance for senior citizens.",
    "timeStamp": "15/09/25 14:56:45"
  },
  {
    "id": "unique_010",
    "transcription": "Can you help me find a cheap health plan?",
    "timeStamp": "15/09/25 14:57:11"
  },
  {
    "id": "unique_011",
    "transcription": "Show me health plans with maternity benefits.",
    "timeStamp": "15/09/25 14:57:39"
  },
  {
    "id": "unique_012",
    "transcription": "I want to purchase medical insurance.",
    "timeStamp": "15/09/25 14:58:05"
  },
  {
    "id": "unique_013",
    "transcription": "Tell me about your health insurance products.",
    "timeStamp": "15/09/25 14:58:22"
  },
  {
    "id": "unique_014",
    "transcription": "Enquiring about health cover.",
    "timeStamp": "15/09/25 14:58:51"
  },
  {
    "id": "unique_015",
    "transcription": "I need health insurance for my parents.",
    "timeStamp": "15/09/25 14:59:13"
  },
  {
    "id": "unique_016",
    "transcription": "What is a top-up health plan?",
    "timeStamp": "15/09/25 14:59:47"
  },
  {
    "id": "unique_017",
    "transcription": "I'm looking to buy health insurance.",
    "timeStamp": "15/09/25 15:00:02"
  },
  {
    "id": "unique_018",
    "transcription": "find me a good health insurance provider.",
    "timeStamp": "15/09/25 15:00:29"
  },
  {
    "id": "unique_019",
    "transcription": "how much does health insurance cost?",
    "timeStamp": "15/09/25 15:00:55"
  },
  {
    "id": "unique_020",
    "transcription": "need info on health insurance policies.",
    "timeStamp": "15/09/25 15:01:21"
  },
  {
    "id": "unique_021",
    "transcription": "looking for a 1 crore health insurance plan.",
    "timeStamp": "15/09/25 15:01:48"
  },
  {
    "id": "unique_022",
    "transcription": "wanna get a medical policy.",
    "timeStamp": "15/09/25 15:02:03"
  },
  {
    "id": "unique_023",
    "transcription": "search for health insurance plans online.",
    "timeStamp": "15/09/25 15:02:33"
  },
  {
    "id": "unique_024",
    "transcription": "what's the process for buying health insurance?",
    "timeStamp": "15/09/25 15:02:59"
  },
  {
    "id": "unique_025",
    "transcription": "help me choose a health insurance plan.",
    "timeStamp": "15/09/25 15:03:15"
  },
  {
    "id": "unique_026",
    "transcription": "i want to see quotes for health insurance.",
    "timeStamp": "15/09/25 15:03:46"
  },
  {
    "id": "unique_027",
    "transcription": "i am searching for a health policy.",
    "timeStamp": "15/09/25 15:04:12"
  },
  {
    "id": "unique_028",
    "transcription": "what are the benefits of this health plan?",
    "timeStamp": "15/09/25 15:04:38"
  },
  {
    "id": "unique_029",
    "transcription": "need medical cover for myself.",
    "timeStamp": "15/09/25 15:05:01"
  },
  {
    "id": "unique_030",
    "transcription": "what is the best family health insurance?",
    "timeStamp": "15/09/25 15:05:29"
  },
  {
    "id": "unique_031",
    "transcription": "looking for individual health insurance.",
    "timeStamp": "15/09/25 15:05:55"
  },
  {
    "id": "unique_032",
    "transcription": "show me top rated health insurance plans.",
    "timeStamp": "15/09/25 15:06:21"
  },
  {
    "id": "unique_033",
    "transcription": "i need to renew my health insurance.",
    "timeStamp": "15/09/25 15:06:47"
  },
  {
    "id": "unique_034",
    "transcription": "can i port my health insurance policy?",
    "timeStamp": "15/09/25 15:07:13"
  },
  {
    "id": "unique_035",
    "transcription": "i need a health plan that covers pre-existing diseases.",
    "timeStamp": "15/09/25 15:07:44"
  },
  {
    "id": "unique_036",
    "transcription": "get a quote for health insurance.",
    "timeStamp": "15/09/25 15:08:05"
  },
  {
    "id": "unique_037",
    "transcription": "i'm looking for a health insurance quote.",
    "timeStamp": "15/09/25 15:08:31"
  },
  {
    "id": "unique_038",
    "transcription": "what details are needed for health insurance?",
    "timeStamp": "15/09/25 15:08:59"
  },
  {
    "id": "unique_039",
    "transcription": "looking for cashless health insurance plans.",
    "timeStamp": "15/09/25 15:09:25"
  },
  {
    "id": "unique_040",
    "transcription": "i need to buy health insurance for my wife.",
    "timeStamp": "15/09/25 15:09:51"
  },
  {
    "id": "unique_041",
    "transcription": "find health insurance plan under 10000.",
    "timeStamp": "15/09/25 15:10:18"
  },
  {
    "id": "unique_042",
    "transcription": "medical insurance plans for diabetes patients.",
    "timeStamp": "15/09/25 15:10:44"
  },
  {
    "id": "unique_043",
    "transcription": "show me health plans without co-payment.",
    "timeStamp": "15/09/25 15:11:09"
  },
  {
    "id": "unique_044",
    "transcription": "searching for health insurance policy documents.",
    "timeStamp": "15/09/25 15:11:35"
  },
  {
    "id": "unique_045",
    "transcription": "wanna check my health insurance status.",
    "timeStamp": "15/09/25 15:12:01"
  },
  {
    "id": "unique_046",
    "transcription": "i want a health insurance plan with critical illness cover.",
    "timeStamp": "15/09/25 15:12:28"
  },
  {
    "id": "unique_047",
    "transcription": "how to claim health insurance?",
    "timeStamp": "15/09/25 15:12:54"
  },
  {
    "id": "unique_048",
    "transcription": "i am looking for a corporate health plan.",
    "timeStamp": "15/09/25 15:13:20"
  },
  {
    "id": "unique_049",
    "transcription": "what is mediclaim?",
    "timeStamp": "15/09/25 15:13:46"
  },
  {
    "id": "unique_050",
    "transcription": "hlth insurnce plans.",
    "timeStamp": "15/09/25 15:14:11"
  }
]

  const wsUrl = 'wss://8a6ae01ced7d.ngrok-free.app'
  const [count, setCount] = useState(0)
  const [ws,setWs] = React.useState(null)


  React.useEffect(()=>{
    const tempWs = new WebSocket(wsUrl);

    tempWs.onopen = (event) => {
      console.log('WebSocket connection opened:', event);
      tempWs.send('Hello from the browser!'); // Send a message to the server
    };

    // Event listener for incoming messages
    tempWs.onmessage = (event) => {
      console.log('Message from server:', event.data);
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
    if(!ws) return ;

      let timeOutId = setTimeout(()=>{
        //sendPostReqToServer()
        console.log('ws msg send')
        ws.send('hello world from ws client')
      },5000)

      
      return ()=>clearTimeout(timeOutId)

  },[ws])

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

        <div className="list" style={{overflowY:'scroll',scrollBehavior:'smooth',height:'65vh'}}>
          {transcriptionData.map((e)=><TranscriptionList e={e}/>)}
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
