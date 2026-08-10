import { createSlice } from "@reduxjs/toolkit";

const transcriptionSlice = createSlice({
    name:'transcriptionSlice',
    initialState:{transcriptions:[]},
    reducers:{
        addTranscription:(state,action)=>{
            const tempObj = {
              transcription:action.payload.text,
              speaker:action.payload.speaker
            }
            state.transcriptions = [tempObj,...state.transcriptions]
        },
        clearTranscriptions:(state)=>{
            state.transcriptions = []
        }
    }
})

export const {addTranscription, clearTranscriptions } = transcriptionSlice.actions;

export default transcriptionSlice.reducer
