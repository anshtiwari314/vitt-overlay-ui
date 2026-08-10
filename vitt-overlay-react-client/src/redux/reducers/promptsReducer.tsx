import { createSlice } from "@reduxjs/toolkit";

const promptsSlice = createSlice({
    name:'promptsSlice',
    initialState:{prompts:[]},
    reducers:{
        addPrompt:(state,action)=>{
            const tempObj = {
              prompt:action.payload.text,
              timestamp:''
            }
            state.prompts = [tempObj,...state.prompts]
        },
        clearPrompts:(state)=>{
            state.prompts = []
        }
    }
})

export const {addPrompt, clearPrompts } = promptsSlice.actions;

export default promptsSlice.reducer
