import { createSlice, current } from "@reduxjs/toolkit";

let initPromptsState = [
    {
        id:'prompt_001',
        prompt:'Give a summary of the meeting',
        timestamp:''
    },
    {
        id:'prompt_002',
         prompt:'Give a summary of the meeting 2',
        timestamp:''
    }
]

let promptsSlice = createSlice({
    name:'transcriptionSlice',
    initialState:{prompts:[]},
    reducers:{
        addPrompt:(state,action)=>{
            console.log('add prompt triggers',state,action)
            let tempObj = {
              prompt:action.payload.text,
              timestamp:''
              //speaker:action.payload.speaker
            }
            console.log('tempObj',tempObj)
            state.prompts = [tempObj,...state.prompts]
            console.log('after modifying state',current(state))
            return state;
        }
    }
})

export const {addPrompt } = promptsSlice.actions;

export default promptsSlice.reducer
