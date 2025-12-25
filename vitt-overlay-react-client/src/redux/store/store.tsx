import { configureStore } from "@reduxjs/toolkit";
import transcriptionReducer from '../reducers/TranscriptionReducer'
import promptsReducer from '../reducers/promptsReducer'

let store = configureStore({
    reducer:{
        transcriptionReducer,
        promptsReducer
    }
    
})


export default store;

