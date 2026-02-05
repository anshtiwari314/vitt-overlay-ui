import { configureStore } from "@reduxjs/toolkit";
import transcriptionReducer from '../reducers/TranscriptionReducer'
import promptsReducer from '../reducers/promptsReducer'
import chatWithAIReducer from '../reducers/chatWithAIReducer'

let store = configureStore({
    reducer:{
        transcriptionReducer,
        promptsReducer,
        chatWithAIReducer
    }
    
})


export default store;

