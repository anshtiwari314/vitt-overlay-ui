import { createSlice, current } from "@reduxjs/toolkit";

let initialLoadState = [
  {
    "id": "unique_001",
    "transcription": "I need a health insurance policy.",
    "timeStamp": "15/09/25 14:53:15",
    "speaker": "agent"
  },
  {
    "id": "unique_002",
    "transcription": "Can you show me some medical insurance plans?",
    "timeStamp": "15/09/25 14:53:48",
    "speaker": "customer"
  },
  {
    "id": "unique_003",
    "transcription": "Looking for health coverage for my family.",
    "timeStamp": "15/09/25 14:54:02",
    "speaker": "customer"
  },
  {
    "id": "unique_004",
    "transcription": "What are the best health insurance options?",
    "timeStamp": "15/09/25 14:54:33",
    "speaker": "agent"
  },
  {
    "id": "unique_005",
    "transcription": "I'm interested in buying a mediclaim policy.",
    "timeStamp": "15/09/25 14:55:01",
    "speaker": "customer"
  },
  {
    "id": "unique_006",
    "transcription": "How do I get health insurance?",
    "timeStamp": "15/09/25 14:55:25",
    "speaker": "customer"
  },
  {
    "id": "unique_007",
    "transcription": "Compare health insurance policies.",
    "timeStamp": "15/09/25 14:55:59",
    "speaker": "customer"
  },
  {
    "id": "unique_008",
    "transcription": "I need a family floater health plan.",
    "timeStamp": "15/09/25 14:56:18",
    "speaker": "customer"
  },
  {
    "id": "unique_009",
    "transcription": "Searching for health insurance for senior citizens.",
    "timeStamp": "15/09/25 14:56:45",
    "speaker": "customer"
  },
  {
    "id": "unique_010",
    "transcription": "Can you help me find a cheap health plan?",
    "timeStamp": "15/09/25 14:57:11",
    "speaker": "customer"
  },
  {
    "id": "unique_011",
    "transcription": "Show me health plans with maternity benefits.",
    "timeStamp": "15/09/25 14:57:39",
    "speaker": "customer"
  },
  {
    "id": "unique_012",
    "transcription": "I want to purchase medical insurance.",
    "timeStamp": "15/09/25 14:58:05",
    "speaker": "customer"
  },
  {
    "id": "unique_013",
    "transcription": "Tell me about your health insurance products.",
    "timeStamp": "15/09/25 14:58:22",
    "speaker": "customer"
  },
  {
    "id": "unique_014",
    "transcription": "Enquiring about health cover.",
    "timeStamp": "15/09/25 14:58:51",
    "speaker": "customer"
  },
  {
    "id": "unique_015",
    "transcription": "I need health insurance for my parents.",
    "timeStamp": "15/09/25 14:59:13",
    "speaker": "customer"
  },
  {
    "id": "unique_016",
    "transcription": "What is a top-up health plan?",
    "timeStamp": "15/09/25 14:59:47",
    "speaker": "customer"
  },
  {
    "id": "unique_017",
    "transcription": "I'm looking to buy health insurance.",
    "timeStamp": "15/09/25 15:00:02",
    "speaker": "customer"
  },
  {
    "id": "unique_018",
    "transcription": "find me a good health insurance provider.",
    "timeStamp": "15/09/25 15:00:29",
    "speaker": "customer"
  },
  {
    "id": "unique_019",
    "transcription": "how much does health insurance cost?",
    "timeStamp": "15/09/25 15:00:55",
    "speaker": "customer"
  },
  {
    "id": "unique_020",
    "transcription": "need info on health insurance policies.",
    "timeStamp": "15/09/25 15:01:21",
    "speaker": "customer"
  },
  {
    "id": "unique_021",
    "transcription": "looking for a 1 crore health insurance plan.",
    "timeStamp": "15/09/25 15:01:48",
    "speaker": "customer"
  },
  {
    "id": "unique_022",
    "transcription": "wanna get a medical policy.",
    "timeStamp": "15/09/25 15:02:03",
    "speaker": "customer"
  },
  {
    "id": "unique_023",
    "transcription": "search for health insurance plans online.",
    "timeStamp": "15/09/25 15:02:33",
    "speaker": "customer"
  },
  {
    "id": "unique_024",
    "transcription": "what's the process for buying health insurance?",
    "timeStamp": "15/09/25 15:02:59",
    "speaker": "customer"
  },
  {
    "id": "unique_025",
    "transcription": "help me choose a health insurance plan.",
    "timeStamp": "15/09/25 15:03:15",
    "speaker": "customer"
  },
  {
    "id": "unique_026",
    "transcription": "i want to see quotes for health insurance.",
    "timeStamp": "15/09/25 15:03:46",
    "speaker": "customer"
  },
  {
    "id": "unique_027",
    "transcription": "i am searching for a health policy.",
    "timeStamp": "15/09/25 15:04:12",
    "speaker": "customer"
  },
  {
    "id": "unique_028",
    "transcription": "what are the benefits of this health plan?",
    "timeStamp": "15/09/25 15:04:38",
    "speaker": "customer"
  },
  {
    "id": "unique_029",
    "transcription": "need medical cover for myself.",
    "timeStamp": "15/09/25 15:05:01",
    "speaker": "customer"
  },
  {
    "id": "unique_030",
    "transcription": "what is the best family health insurance?",
    "timeStamp": "15/09/25 15:05:29",
    "speaker": "customer"
  },
  {
    "id": "unique_031",
    "transcription": "looking for individual health insurance.",
    "timeStamp": "15/09/25 15:05:55",
    "speaker": "customer"
  },
  {
    "id": "unique_032",
    "transcription": "show me top rated health insurance plans.",
    "timeStamp": "15/09/25 15:06:21",
    "speaker": "customer"
  },
  {
    "id": "unique_033",
    "transcription": "i need to renew my health insurance.",
    "timeStamp": "15/09/25 15:06:47",
    "speaker": "customer"
  },
  {
    "id": "unique_034",
    "transcription": "can i port my health insurance policy?",
    "timeStamp": "15/09/25 15:07:13",
    "speaker": "customer"
  },
  {
    "id": "unique_035",
    "transcription": "i need a health plan that covers pre-existing diseases.",
    "timeStamp": "15/09/25 15:07:44",
    "speaker": "customer"
  },
  {
    "id": "unique_036",
    "transcription": "get a quote for health insurance.",
    "timeStamp": "15/09/25 15:08:05",
    "speaker": "customer"
  },
  {
    "id": "unique_037",
    "transcription": "i'm looking for a health insurance quote.",
    "timeStamp": "15/09/25 15:08:31",
    "speaker": "customer"
  },
  {
    "id": "unique_038",
    "transcription": "what details are needed for health insurance?",
    "timeStamp": "15/09/25 15:08:59",
    "speaker": "customer"
  },
  {
    "id": "unique_039",
    "transcription": "looking for cashless health insurance plans.",
    "timeStamp": "15/09/25 15:09:25",
    "speaker": "customer"
  },
  {
    "id": "unique_040",
    "transcription": "i need to buy health insurance for my wife.",
    "timeStamp": "15/09/25 15:09:51",
    "speaker": "customer"
  },
  {
    "id": "unique_041",
    "transcription": "find health insurance plan under 10000.",
    "timeStamp": "15/09/25 15:10:18",
    "speaker": "customer"
  },
  {
    "id": "unique_042",
    "transcription": "medical insurance plans for diabetes patients.",
    "timeStamp": "15/09/25 15:10:44",
    "speaker": "customer"
  },
  {
    "id": "unique_043",
    "transcription": "show me health plans without co-payment.",
    "timeStamp": "15/09/25 15:11:09",
    "speaker": "customer"
  },
  {
    "id": "unique_044",
    "transcription": "searching for health insurance policy documents.",
    "timeStamp": "15/09/25 15:11:35",
    "speaker": "customer"
  },
  {
    "id": "unique_045",
    "transcription": "wanna check my health insurance status.",
    "timeStamp": "15/09/25 15:12:01",
    "speaker": "customer"
  },
  {
    "id": "unique_046",
    "transcription": "i want a health insurance plan with critical illness cover.",
    "timeStamp": "15/09/25 15:12:28",
    "speaker": "customer"
  },
  {
    "id": "unique_047",
    "transcription": "how to claim health insurance?",
    "timeStamp": "15/09/25 15:12:54",
    "speaker": "customer"
  },
  {
    "id": "unique_048",
    "transcription": "i am looking for a corporate health plan.",
    "timeStamp": "15/09/25 15:13:20",
    "speaker": "customer"
  },
  {
    "id": "unique_049",
    "transcription": "what is mediclaim?",
    "timeStamp": "15/09/25 15:13:46",
    "speaker": "customer"
  },
  {
    "id": "unique_050",
    "transcription": "hlth insurnce plans.",
    "timeStamp": "15/09/25 15:14:11",
    "speaker": "customer"
  }
]

let transcriptionSlice = createSlice({
    name:'transcriptionSlice',
    initialState:{transcriptions:[]},
    reducers:{
        addTranscription:(state,action)=>{
            console.log('add Transcription triggers',state,action)
            let tempObj = {
              transcription:action.payload.text,
              speaker:action.payload.speaker
            }
            console.log('tempObj',tempObj)
            state.transcriptions = [tempObj,...state.transcriptions]
            console.log('after modifying state',current(state))
            return state;
        }
    }
})

export const {addTranscription } = transcriptionSlice.actions;

export default transcriptionSlice.reducer

